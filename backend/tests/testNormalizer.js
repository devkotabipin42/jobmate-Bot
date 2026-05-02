import { MetaPayloadNormalizer } from "../src/services/whatsapp/metaPayloadNormalizer.service.js";

const sampleTextPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "123456789",
            },
            contacts: [
              {
                profile: {
                  name: "Suresh Thapa",
                },
                wa_id: "9779800000000",
              },
            ],
            messages: [
              {
                from: "9779800000000",
                id: "wamid.TEST123",
                timestamp: "1710000000",
                type: "text",
                text: {
                  body: "Job chaiyo",
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

const result = MetaPayloadNormalizer.normalize(sampleTextPayload);

console.log(JSON.stringify(result, null, 2));