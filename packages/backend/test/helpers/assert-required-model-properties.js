import { ValidationError } from 'objection';
import { expect } from 'vitest';

export default async function assertRequiredSchemaProperties(model) {
  const requiredProperties = model.jsonSchema.required;

  const expectedValidationErrorPayload = {
    data: {},
  };

  for (const requiredProperty of requiredProperties) {
    expectedValidationErrorPayload.data[requiredProperty] = [
      {
        message: `must have required property '${requiredProperty}'`,
      },
    ];
  }

  const expectedError = new ValidationError(expectedValidationErrorPayload);

  await expect(() => model.query().insert({})).rejects.toStrictEqual(
    expectedError
  );
}
