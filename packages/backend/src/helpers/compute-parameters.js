import get from 'lodash.get';

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[^.}{]+)+}})/g;

function getFieldByKey(key, fields = []) {
  return fields.find((field) => field.key === key);
};

export default function computeParameters(parameters, fields, executionSteps) {
  const entries = Object.entries(parameters);

  return entries.reduce((result, [key, value]) => {
    const parameterField = getFieldByKey(key, fields);
    const valueType = parameterField?.valueType || 'string';

    if (typeof value === 'string') {
      const parts = value.split(variableRegExp);

      const computedValue = parts
        .map((part) => {
          const isVariable = part.match(variableRegExp);

          if (isVariable) {
            const stepIdAndKeyPath = part.replace(/{{step.|}}/g, '');
            const [stepId, ...keyPaths] = stepIdAndKeyPath.split('.');
            const keyPath = keyPaths.join('.');
            const executionStep = executionSteps.find((executionStep) => {
              return executionStep.stepId === stepId;
            });
            const data = executionStep?.dataOut;
            const dataValue = get(data, keyPath);

            // Covers both arrays and objects
            if (typeof dataValue === 'object') {
              return JSON.stringify(dataValue);
            }

            return dataValue;
          }

          return part;
        }).join('');

      if (valueType !== 'parse') {
        return {
          ...result,
          [key]: computedValue,
        };
      }

      // challenge the input to see if it is stringifies object or array
      try {
        const parsedValue = JSON.parse(computedValue);

        if (typeof parsedValue === 'number') {
          throw new Error('Use original unparsed value.');
        }

        return {
          ...result,
          [key]: parsedValue,
        };
      } catch (error) {
        return {
          ...result,
          [key]: computedValue,
        };
      }
    }

    if (Array.isArray(value)) {
      return {
        ...result,
        [key]: value.map((item) => computeParameters(item, parameterField?.fields, executionSteps)),
      };
    }

    return {
      ...result,
      [key]: value,
    };
  }, {});
}
