import { describe, it, expect, vi } from 'vitest';

import App from './app.js';
import * as getAppModule from '../helpers/get-app.js';
import * as appInfoConverterModule from '../helpers/app-info-converter.js';

describe('App model', () => {
  it('folderPath should return correct path', () => {
    expect(App.folderPath).toEqual(
      expect.stringMatching(/\/packages\/backend\/src\/apps$/)
    );
  });

  it('list should have list of applications keys', () => {
    expect(App.list).toMatchSnapshot();
  });

  describe('findAll', () => {
    it('should return all applications', async () => {
      const apps = await App.findAll();

      expect(apps.length).toBe(App.list.length);
    });

    it('should return matching applications when name argument is given', async () => {
      const apps = await App.findAll('deepl');

      expect(apps.length).toBe(1);
      expect(apps[0].key).toBe('deepl');
    });

    it('should return matching applications in plain JSON when stripFunc argument is true', async () => {
      const appFindOneByNameSpy = vi.spyOn(App, 'findOneByName');

      await App.findAll('deepl', true);

      expect(appFindOneByNameSpy).toHaveBeenCalledWith('deepl', true);
    });
  });

  describe('findOneByName', () => {
    it('should return app info for given app name', async () => {
      const appInfo = await App.findOneByName('DeepL');

      expect(appInfo.key).toBe('deepl');
      expect(appInfo).toMatchSnapshot();
    });

    it('should return app info for given app name in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => 'mock-app');

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation(() => 'app-info');

      const app = await App.findOneByName('DeepL', true);

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith('mock-app');
      expect(app).toStrictEqual('app-info');
    });
  });

  describe('findOneByKey', () => {
    it('should return app info for given app key', async () => {
      const appInfo = await App.findOneByKey('deepl');

      expect(appInfo.key).toBe('deepl');
      expect(appInfo).toMatchSnapshot();
    });

    it('should return app info for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => 'mock-app');

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation(() => 'app-info');

      const app = await App.findOneByKey('deepl', true);

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith('mock-app');
      expect(app).toStrictEqual('app-info');
    });
  });

  describe('findAuthByKey', () => {
    it('should return app auth for given app key', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ auth: 'mock-auth' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appAuth = await App.findAuthByKey('deepl');

      expect(getAppSpy).toHaveBeenCalledWith('deepl', false);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({ auth: 'mock-auth' });
      expect(appAuth).toStrictEqual('mock-auth');
    });

    it('should return app auth for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ auth: 'mock-auth' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appAuth = await App.findAuthByKey('deepl', true);

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({ auth: 'mock-auth' });
      expect(appAuth).toStrictEqual('mock-auth');
    });
  });

  describe('findTriggersByKey', () => {
    it('should return app triggers for given app key', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ triggers: 'mock-triggers' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appTriggers = await App.findTriggersByKey('deepl');

      expect(getAppSpy).toHaveBeenCalledWith('deepl', false);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        triggers: 'mock-triggers',
      });
      expect(appTriggers).toStrictEqual('mock-triggers');
    });

    it('should return app triggers for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ triggers: 'mock-triggers' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appTriggers = await App.findTriggersByKey('deepl', true);

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        triggers: 'mock-triggers',
      });
      expect(appTriggers).toStrictEqual('mock-triggers');
    });
  });

  describe('findTriggerSubsteps', () => {
    it('should return app trigger substeps for given app key', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({
          triggers: [{ key: 'mock-trigger', substeps: 'mock-substeps' }],
        }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appTriggerSubsteps = await App.findTriggerSubsteps(
        'deepl',
        'mock-trigger'
      );

      expect(getAppSpy).toHaveBeenCalledWith('deepl', false);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        triggers: [{ key: 'mock-trigger', substeps: 'mock-substeps' }],
      });
      expect(appTriggerSubsteps).toStrictEqual('mock-substeps');
    });

    it('should return app trigger substeps for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({
          triggers: [{ key: 'mock-trigger', substeps: 'mock-substeps' }],
        }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appTriggerSubsteps = await App.findTriggerSubsteps(
        'deepl',
        'mock-trigger',
        true
      );

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        triggers: [{ key: 'mock-trigger', substeps: 'mock-substeps' }],
      });
      expect(appTriggerSubsteps).toStrictEqual('mock-substeps');
    });
  });

  describe('findActionsByKey', () => {
    it('should return app actions for given app key', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ actions: 'mock-actions' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appActions = await App.findActionsByKey('deepl');

      expect(getAppSpy).toHaveBeenCalledWith('deepl', false);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        actions: 'mock-actions',
      });
      expect(appActions).toStrictEqual('mock-actions');
    });

    it('should return app actions for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({ actions: 'mock-actions' }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appActions = await App.findActionsByKey('deepl', true);

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        actions: 'mock-actions',
      });
      expect(appActions).toStrictEqual('mock-actions');
    });
  });

  describe('findActionSubsteps', () => {
    it('should return app action substeps for given app key', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({
          actions: [{ key: 'mock-action', substeps: 'mock-substeps' }],
        }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appActionSubsteps = await App.findActionSubsteps(
        'deepl',
        'mock-action'
      );

      expect(getAppSpy).toHaveBeenCalledWith('deepl', false);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        actions: [{ key: 'mock-action', substeps: 'mock-substeps' }],
      });
      expect(appActionSubsteps).toStrictEqual('mock-substeps');
    });

    it('should return app action substeps for given app key in plain JSON when stripFunc argument is true', async () => {
      const getAppSpy = vi
        .spyOn(getAppModule, 'default')
        .mockImplementation(() => ({
          actions: [{ key: 'mock-action', substeps: 'mock-substeps' }],
        }));

      const appInfoConverterSpy = vi
        .spyOn(appInfoConverterModule, 'default')
        .mockImplementation((input) => input);

      const appActionSubsteps = await App.findActionSubsteps(
        'deepl',
        'mock-action',
        true
      );

      expect(getAppSpy).toHaveBeenCalledWith('deepl', true);
      expect(appInfoConverterSpy).toHaveBeenCalledWith({
        actions: [{ key: 'mock-action', substeps: 'mock-substeps' }],
      });
      expect(appActionSubsteps).toStrictEqual('mock-substeps');
    });
  });
});
