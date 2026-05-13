// Generic conversation engine — business-agnostic.
// Tenants pass a config (extractor + required fields + messages).
// Engine reads collectedData, finds next missing field, asks for it.
// Engine ALSO persists conversation.metadata + currentState to Mongo
// so the controller does not need to know about engine internals.

export async function runConversationEngine({
  contact,
  conversation,
  normalizedMessage,
  config,
}) {
  const text = normalizedMessage?.message?.normalizedText || "";
  const metadata = conversation?.metadata || {};
  let profile = { ...(metadata.collectedData || {}) };
  const lastAskedField = metadata.lastAskedField || null;
  const baseContext = {
    contact,
    conversation,
    normalizedMessage,
    text,
    lastAskedField,
    currentState: conversation?.currentState || null,
    currentIntent: conversation?.currentIntent || null,
  };
  const sanitizeProfile = (nextProfile, stage) => {
    if (typeof config.sanitizeProfile !== "function") {
      return nextProfile;
    }

    try {
      return config.sanitizeProfile({
        ...baseContext,
        profile: nextProfile,
        stage,
      }) || nextProfile;
    } catch (error) {
      console.error("⚠️ sanitizeProfile failed:", error?.message);
      return nextProfile;
    }
  };

  // Step 1: If user is replying to a specific question, parse that reply FIRST.
  // (Parse before extractor so numeric replies like "5" get assigned correctly.)
  if (lastAskedField) {
    const field = config.requiredFields.find((f) => f.key === lastAskedField);
    if (field && typeof field.parse === "function") {
      try {
        const parsed = field.parse(text, profile, baseContext);
        if (parsed !== null && parsed !== undefined && parsed !== "") {
          profile[lastAskedField] = parsed;
        }
      } catch (error) {
        console.error(`⚠️ Parse failed for ${lastAskedField}:`, error?.message);
      }
    }
  }

  // Step 2: Run business-specific extractor on the message.
  // Extractor returns partial profile updates (e.g., {location, district}).
  let extracted = {};
  if (typeof config.extractor === "function") {
    try {
      extracted = (await config.extractor({ ...baseContext, profile })) || {};
    } catch (error) {
      console.error("⚠️ Extractor failed:", error?.message);
    }
  }
  Object.assign(profile, extracted);
  profile = sanitizeProfile(profile, "after_extractor");

  // Step 2.4: Run search step if defined (e.g., job search before profile collection)
  // Only runs once — uses profile.jobSearchDone flag to avoid repeats.
  let shouldRunSearchStep = typeof config.searchStep === "function";
  if (shouldRunSearchStep && typeof config.shouldRunSearchStep === "function") {
    try {
      shouldRunSearchStep = Boolean(config.shouldRunSearchStep({
        ...baseContext,
        profile,
      }));
    } catch (error) {
      console.error("⚠️ shouldRunSearchStep failed:", error?.message);
      shouldRunSearchStep = false;
    }
  }

  if (shouldRunSearchStep && typeof config.searchStep === "function") {
    try {
      const searchResult = await config.searchStep(profile, text);
      if (searchResult) {
        Object.assign(profile, searchResult.profileUpdates || {});
        profile = sanitizeProfile(profile, "after_search");
        // Persist and return search reply
        if (conversation && conversation._id) {
          try {
            const Model = conversation.constructor;
            await Model.updateOne(
              { _id: conversation._id },
              {
                $set: {
                  currentState: searchResult.state || "search_done",
                  "metadata.collectedData": profile,
                  "metadata.lastAskedField": searchResult.lastAskedField || null,
                },
              },
              { runValidators: false }
            );
          } catch (error) {
            console.error("⚠️ searchStep save failed:", error?.message);
          }
        }
        return {
          messageToSend: searchResult.messageToSend,
          newMetadata: {
            collectedData: profile,
            lastAskedField: searchResult.lastAskedField || null,
            currentState: searchResult.state || "search_done",
          },
          isComplete: false,
        };
      }
    } catch (error) {
      console.error("⚠️ searchStep failed:", error?.message);
    }
  }

  // Step 2.5: Allow config to short-circuit the flow (e.g., outside-region rejection)
  if (typeof config.shortCircuit === "function") {
    const shortReply = config.shortCircuit(profile);
    if (shortReply) {
      profile = sanitizeProfile(profile, "before_short_circuit");
      // Persist and return early
      if (conversation && conversation._id) {
        try {
          const Model = conversation.constructor;
          await Model.updateOne(
            { _id: conversation._id },
            {
              $set: {
                currentState: "rejected",
                "metadata.collectedData": profile,
                "metadata.lastAskedField": null,
              },
            },
            { runValidators: false }
          );
        } catch (error) {
          console.error("⚠️ shortCircuit save failed:", error?.message);
        }
      }
      return {
        messageToSend: shortReply,
        newMetadata: { collectedData: profile, lastAskedField: null, currentState: "rejected" },
        isComplete: false,
      };
    }
  }

  // Step 3: Find next field to ask (skipping filled or skip-conditioned).
  const nextField = config.requiredFields.find((field) => {
    if (typeof field.skipIf === "function" && field.skipIf(profile)) return false;
    return (
      profile[field.key] === undefined ||
      profile[field.key] === null ||
      profile[field.key] === ""
    );
  });

  // Step 4: Build response (completion or next question).
  let messageToSend;
  let newCurrentState;
  let newLastAskedField;
  let isComplete = false;

  if (!nextField) {
    profile = sanitizeProfile(profile, "before_completion");
    messageToSend =
      typeof config.completionMessage === "function"
        ? config.completionMessage(profile)
        : "Dhanyabaad! 🙏";
    newCurrentState = "completed";
    newLastAskedField = null;
    isComplete = true;

    if (typeof config.onComplete === "function") {
      try {
        await config.onComplete({ contact, profile, conversation });
      } catch (error) {
        console.error("⚠️ onComplete failed:", error?.message);
      }
    }
  } else {
    profile = sanitizeProfile(profile, "before_next_question");
    messageToSend =
      typeof nextField.ask === "function"
        ? nextField.ask(profile)
        : `Please provide ${nextField.key}`;
    newCurrentState = `ask_${nextField.key}`;
    newLastAskedField = nextField.key;
  }

  // Step 5: Persist conversation state to Mongo.
  // Use updateOne with $set to avoid validation errors on unrelated fields
  // (e.g., legacy enum values, businessReceptionist subdoc).
  if (conversation && conversation._id) {
    try {
      const Model = conversation.constructor;
      await Model.updateOne(
        { _id: conversation._id },
        {
          $set: {
            currentState: newCurrentState,
            "metadata.collectedData": profile,
            "metadata.lastAskedField": newLastAskedField,
          },
        },
        { runValidators: false }
      );
      // In-memory mutation removed — triggers Mongoose schema validation
    } catch (error) {
      console.error("⚠️ conversation update failed:", error?.message);
    }
  }

  return {
    messageToSend,
    newMetadata: {
      collectedData: profile,
      lastAskedField: newLastAskedField,
      currentState: newCurrentState,
    },
    isComplete,
  };
}
