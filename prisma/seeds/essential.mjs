// Seeds system-critical data that is safe to run in production:
// roles, permissions, role-permission matrix, settings catalog, admin user,
// and reference geography (currency, country, state, city).

import { SettingType } from "@prisma/client";

import { assignUserRole, upsertUser } from "./utils.mjs";
import { PERMISSION_DEFINITIONS, ROLE_PERMISSION_MAP, SYSTEM_ROLES } from "./rbac-data.mjs";

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {unknown[]} settingsCatalog  Parsed contents of lib/settings/settings-catalog.json
 * @returns {{ roleRecords, permissionRecords, adminUser, kochi }}
 */
export async function seedEssentialData(prisma, settingsCatalog) {
  // --- Seed RBAC: Roles ---
  const roleRecords = {};
  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description, isSystemRole: true, isActive: true },
      create: { name: roleDef.name, code: roleDef.code, description: roleDef.description, isSystemRole: true, isActive: true },
    });
    roleRecords[roleDef.code] = role;
  }

  // --- Seed RBAC: Permissions ---
  const permissionRecords = {};
  for (const permDef of PERMISSION_DEFINITIONS) {
    const perm = await prisma.permission.upsert({
      where: { key: permDef.key },
      update: { module: permDef.module, action: permDef.action, description: permDef.description },
      create: { module: permDef.module, action: permDef.action, key: permDef.key, description: permDef.description },
    });
    permissionRecords[permDef.key] = perm;
  }

  // --- Seed RBAC: Role-Permission matrix ---
  for (const [roleCode, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = roleRecords[roleCode];
    for (const permKey of permKeys) {
      const perm = permissionRecords[permKey];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // --- Seed settings categories and definitions ---
  for (const categoryDef of settingsCatalog) {
    const category = await prisma.settingsCategory.upsert({
      where: { code: categoryDef.code },
      update: {
        name: categoryDef.name,
        description: categoryDef.description ?? null,
        icon: categoryDef.icon ?? null,
        displayOrder: categoryDef.displayOrder,
        isSystem: categoryDef.isSystem !== false,
        isActive: true,
      },
      create: {
        name: categoryDef.name,
        code: categoryDef.code,
        description: categoryDef.description ?? null,
        icon: categoryDef.icon ?? null,
        displayOrder: categoryDef.displayOrder,
        isSystem: categoryDef.isSystem !== false,
        isActive: true,
      },
    });

    for (const settingDef of categoryDef.settings) {
      await prisma.setting.upsert({
        where: { key: settingDef.key },
        update: {
          categoryId: category.id,
          label: settingDef.label,
          description: settingDef.description ?? null,
          type: settingDef.type ?? SettingType.TEXT,
          defaultValue: settingDef.defaultValue ?? null,
          placeholder: settingDef.placeholder ?? null,
          helpText: settingDef.helpText ?? null,
          options: settingDef.options ?? null,
          validationRules: settingDef.validationRules ?? null,
          groupName: settingDef.groupName ?? null,
          displayOrder: settingDef.displayOrder,
          isRequired: settingDef.isRequired === true,
          isEncrypted: settingDef.isEncrypted === true,
          isReadonly: settingDef.isReadonly === true,
          isSystem: settingDef.isSystem !== false,
          isActive: settingDef.isActive !== false,
        },
        create: {
          categoryId: category.id,
          key: settingDef.key,
          label: settingDef.label,
          description: settingDef.description ?? null,
          type: settingDef.type ?? SettingType.TEXT,
          defaultValue: settingDef.defaultValue ?? null,
          placeholder: settingDef.placeholder ?? null,
          helpText: settingDef.helpText ?? null,
          options: settingDef.options ?? null,
          validationRules: settingDef.validationRules ?? null,
          groupName: settingDef.groupName ?? null,
          displayOrder: settingDef.displayOrder,
          isRequired: settingDef.isRequired === true,
          isEncrypted: settingDef.isEncrypted === true,
          isReadonly: settingDef.isReadonly === true,
          isSystem: settingDef.isSystem !== false,
          isActive: settingDef.isActive !== false,
        },
      });
    }
  }

  // --- Seed admin user ---
  const adminUser = await upsertUser(prisma, {
    email: "arjakroy2411@gmail.com",
    name: "Academy Admin",
    phone: "+91-9000000001",
    password: "dev-password",
  });
  await assignUserRole(prisma, adminUser.id, roleRecords.SUPER_ADMIN.id);

  // --- Seed reference data: currency and geography ---
  await prisma.currency.upsert({
    where: { code: "INR" },
    update: { symbol: "Rs" },
    create: { code: "INR", symbol: "Rs" },
  });

  const india = await prisma.country.upsert({
    where: { isoCode: "IN" },
    update: { name: "India" },
    create: { name: "India", isoCode: "IN" },
  });

  const kerala = await prisma.state.upsert({
    where: { id: 1 },
    update: { name: "Kerala", countryId: india.id },
    create: { id: 1, name: "Kerala", countryId: india.id },
  });

  const kochi = await prisma.city.upsert({
    where: { id: 1 },
    update: { name: "Kochi", stateId: kerala.id },
    create: { id: 1, name: "Kochi", stateId: kerala.id },
  });

  console.log("Essential data seeded", {
    roles: Object.keys(roleRecords).length,
    permissions: Object.keys(permissionRecords).length,
  });

  return { roleRecords, permissionRecords, adminUser, kochi };
}
