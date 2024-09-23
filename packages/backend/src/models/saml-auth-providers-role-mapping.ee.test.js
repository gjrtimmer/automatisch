import { describe, it, expect } from 'vitest';
import SamlAuthProvidersRoleMapping from '../models/saml-auth-providers-role-mapping.ee';
import SamlAuthProvider from './saml-auth-provider.ee';

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

  it('relationMappings should have samlAuthProvider relation', () => {
    const samlAuthProviderRelation =
      SamlAuthProvidersRoleMapping.relationMappings().samlAuthProvider;

    expect(samlAuthProviderRelation).toMatchSnapshot();
    expect(samlAuthProviderRelation.relation).toStrictEqual(
      SamlAuthProvidersRoleMapping.BelongsToOneRelation
    );
    expect(samlAuthProviderRelation.modelClass).toStrictEqual(SamlAuthProvider);
  });
});
