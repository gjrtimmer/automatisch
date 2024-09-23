import { describe, it, expect } from 'vitest';
import SamlAuthProvidersRoleMapping from '../models/saml-auth-providers-role-mapping.ee';

describe('SamlAuthProvidersRoleMapping model', () => {
  it('tableName should return correct name', () => {
    expect(SamlAuthProvidersRoleMapping.tableName).toBe(
      'saml_auth_providers_role_mappings'
    );
  });

  it('jsonSchema should have the correct schema', () => {
    expect(SamlAuthProvidersRoleMapping.jsonSchema).toMatchSnapshot();
  });

  it('required properties should be required', async () => {
    expect(SamlAuthProvidersRoleMapping).toRequireProperty('remoteRoleName');
    expect(SamlAuthProvidersRoleMapping).toRequireProperty('roleId');
    expect(SamlAuthProvidersRoleMapping).toRequireProperty(
      'samlAuthProviderId'
    );
  });
});
