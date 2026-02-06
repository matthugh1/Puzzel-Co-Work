import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { validatePasswordStrength } from "../src/lib/password";

const prisma = new PrismaClient();

// Use bcrypt for password hashing (same as production)
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🌱 Seeding database...");

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@puzzel.com";
  const adminName = process.env.ADMIN_NAME ?? "Admin";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required to seed the admin user.");
  }

  const passwordValidation = validatePasswordStrength(adminPassword);
  if (!passwordValidation.valid) {
    throw new Error(
      `ADMIN_PASSWORD does not meet requirements: ${passwordValidation.errors.join(" ")}`,
    );
  }

  // ============================================================================
  // PERMISSIONS
  // ============================================================================
  console.log("Creating permissions...");

  const permissions = [
    { name: "users:read", description: "View users" },
    { name: "users:admin", description: "Manage users and roles" },
    { name: "organizations:create", description: "Create organizations" },
    { name: "organizations:read", description: "View organizations" },
    { name: "organizations:update", description: "Update organizations" },
    { name: "organizations:admin", description: "Manage organization settings" },
    { name: "organizations:manage_members", description: "Add/remove organization members" },
    { name: "audit:read", description: "View audit logs" },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // ============================================================================
  // ROLES
  // ============================================================================
  console.log("Creating roles...");


  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: { isSystem: true },
    create: {
      name: "admin",
      description: "Full system access",
      isSystem: true, // Global admin role
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: "viewer" },
    update: { isSystem: true },
    create: {
      name: "viewer",
      description: "Can view basic information",
      isSystem: true, // Global viewer role
    },
  });

  // ============================================================================
  // ROLE PERMISSIONS
  // ============================================================================
  console.log("Assigning permissions to roles...");

  // Viewer gets read permissions
  const usersReadPerm = await prisma.permission.findUnique({
    where: { name: "users:read" },
  });
  const auditReadPerm = await prisma.permission.findUnique({
    where: { name: "audit:read" },
  });

  if (usersReadPerm) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: viewerRole.id,
          permissionId: usersReadPerm.id,
        },
      },
      update: {},
      create: {
        roleId: viewerRole.id,
        permissionId: usersReadPerm.id,
      },
    });
  }

  if (auditReadPerm) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: viewerRole.id,
          permissionId: auditReadPerm.id,
        },
      },
      update: {},
      create: {
        roleId: viewerRole.id,
        permissionId: auditReadPerm.id,
      },
    });
  }

  // Admin gets all permissions
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // ============================================================================
  // ADMIN USER
  // ============================================================================
  console.log("Creating admin user...");

  const passwordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      authProvider: "LOCAL",
    },
  });

  // Assign admin role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================
  console.log("Creating default organization...");

  const defaultOrg = await prisma.organization.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
      isActive: true,
    },
  });

  // ============================================================================
  // ORGANIZATION ROLES
  // ============================================================================
  console.log("Creating organization roles...");

  const orgAdminRole = await prisma.organizationRole.upsert({
    where: {
      organizationId_name: {
        organizationId: defaultOrg.id,
        name: "admin",
      },
    },
    update: {},
    create: {
      organizationId: defaultOrg.id,
      name: "admin",
      description: "Organization administrator",
    },
  });

  const orgMemberRole = await prisma.organizationRole.upsert({
    where: {
      organizationId_name: {
        organizationId: defaultOrg.id,
        name: "member",
      },
    },
    update: {},
    create: {
      organizationId: defaultOrg.id,
      name: "member",
      description: "Organization member",
    },
  });

  const orgViewerRole = await prisma.organizationRole.upsert({
    where: {
      organizationId_name: {
        organizationId: defaultOrg.id,
        name: "viewer",
      },
    },
    update: {},
    create: {
      organizationId: defaultOrg.id,
      name: "viewer",
      description: "Organization viewer",
    },
  });

  // ============================================================================
  // ORGANIZATION ROLE PERMISSIONS
  // ============================================================================
  console.log("Assigning permissions to organization roles...");

  // Org admin gets all org permissions
  const orgPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: [
          "organizations:read",
          "organizations:update",
          "organizations:admin",
          "organizations:manage_members",
          "users:read",
          "users:admin",
        ],
      },
    },
  });

  for (const perm of orgPermissions) {
    await prisma.organizationRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: orgAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: orgAdminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Org member gets basic permissions
  const memberPerms = await prisma.permission.findMany({
    where: {
      name: {
        in: ["organizations:read", "users:read"],
      },
    },
  });

  for (const perm of memberPerms) {
    await prisma.organizationRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: orgMemberRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: orgMemberRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Org viewer gets read-only permissions
  const viewerPerms = await prisma.permission.findMany({
    where: {
      name: {
        in: ["organizations:read", "users:read"],
      },
    },
  });

  for (const perm of viewerPerms) {
    await prisma.organizationRolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: orgViewerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: orgViewerRole.id,
        permissionId: perm.id,
      },
    });
  }

  // ============================================================================
  // ASSIGN ADMIN USER TO DEFAULT ORGANIZATION
  // ============================================================================
  console.log("Assigning admin user to default organization...");

  await prisma.organizationUser.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: defaultOrg.id,
      },
    },
    update: {
      roleId: orgAdminRole.id,
    },
    create: {
      userId: adminUser.id,
      organizationId: defaultOrg.id,
      roleId: orgAdminRole.id,
    },
  });

  console.log("✅ Database seeded successfully!");
  console.log(`   Admin user: ${adminEmail}`);
  console.log(`   Admin password: [set via ADMIN_PASSWORD env var]`);
  console.log(`   Default organization: ${defaultOrg.name} (${defaultOrg.slug})`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
