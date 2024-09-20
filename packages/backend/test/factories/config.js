import Config from '../../src/models/config';

export const updateConfig = async (params = {}) => {
  return await Config.update(params);
};

export const markInstallationCompleted = async () => {
  return await updateConfig({
    installationCompleted: true,
  });
};
