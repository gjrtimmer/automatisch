import { ValidationError } from 'objection';
import Base from './base.js';
import Permission from './permission.js';
import User from './user.js';
import SamlAuthProvider from './saml-auth-provider.ee.js';
import NotAuthorizedError from '../errors/not-authorized.js';

class Role extends Base {
  static tableName = 'roles';

  static jsonSchema = {
    type: 'object',
    required: ['name'],

    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', minLength: 1 },
      description: { type: ['string', 'null'], maxLength: 255 },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
  };

  static relationMappings = () => ({
    users: {
      relation: Base.HasManyRelation,
      modelClass: User,
      join: {
        from: 'roles.id',
        to: 'users.role_id',
      },
    },
    permissions: {
      relation: Base.HasManyRelation,
      modelClass: Permission,
      join: {
        from: 'roles.id',
        to: 'permissions.role_id',
      },
    },
  });

  static get virtualAttributes() {
    return ['isAdmin'];
  }

  get isAdmin() {
    return this.name === 'Admin';
  }

  static async findAdmin() {
    return await this.query().findOne({ name: 'Admin' });
  }

  preventAlteringAdmin() {
    if (this.isAdmin) {
      throw new NotAuthorizedError('The admin role cannot be altered!');
    }
  }

  async deletePermissions(trx) {
    return await this.$relatedQuery('permissions', trx).delete();
  }

  async createPermissions(permissions, trx) {
    if (permissions?.length) {
      const validPermissions = Permission.filter(permissions).map(
        (permission) => ({
          ...permission,
          roleId: this.id,
        })
      );

      await Permission.query(trx).insert(validPermissions);
    }

    return this;
  }

  async overridePermissions(permissions, trx) {
    await this.deletePermissions(trx);

    await this.createPermissions(permissions, trx);

    return this;
  }

  async updateWithPermissions(data) {
    this.preventAlteringAdmin();

    const { name, description, permissions } = data;

    return await Role.transaction(async (trx) => {
      await this.overridePermissions(permissions, trx);

      await this.$query(trx).patch({
        name,
        description,
      });

      // TODO: consider removing returning permissions as they're not utilized
      return await this.$query(trx)
        .leftJoinRelated({
          permissions: true,
        })
        .withGraphFetched({
          permissions: true,
        });
    });
  }

  async deleteWithPermissions() {
    return await Role.transaction(async (trx) => {
      await this.deletePermissions(trx);

      return await this.$query(trx).delete();
    });
  }

  async assertNoRoleUserExists() {
    const userCount = await this.$relatedQuery('users').limit(1).resultSize();
    const hasUsers = userCount > 0;

    if (hasUsers) {
      throw new ValidationError({
        data: {
          role: [
            {
              message: `All users must be migrated away from the "${this.name}" role.`,
            },
          ],
        },
        type: 'ValidationError',
      });
    }
  }

  async assertNoConfigurationUsage() {
    const samlAuthProviderUsingDefaultRole = await SamlAuthProvider.query()
      .where({
        default_role_id: this.id,
      })
      .limit(1)
      .first();

    if (samlAuthProviderUsingDefaultRole) {
      throw new ValidationError({
        data: {
          samlAuthProvider: [
            {
              message:
                'You need to change the default role in the SAML configuration before deleting this role.',
            },
          ],
        },
        type: 'ValidationError',
      });
    }
  }

  async assertRoleIsNotUsed() {
    await this.assertNoRoleUserExists();

    await this.assertNoConfigurationUsage();
  }

  async $beforeDelete(queryContext) {
    await super.$beforeDelete(queryContext);

    this.preventAlteringAdmin();

    await this.assertRoleIsNotUsed();
  }
}

export default Role;
