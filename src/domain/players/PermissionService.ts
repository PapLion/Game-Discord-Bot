export enum BotRole {
  OWNER = 5,
  ADMIN = 4,
  MODERATOR = 3,
  PLAYER = 2,
  BANNED = 1,
}

export const ROLE_HIERARCHY: BotRole[] = [
  BotRole.BANNED,
  BotRole.PLAYER,
  BotRole.MODERATOR,
  BotRole.ADMIN,
  BotRole.OWNER,
];

export function hasPermission(userRole: BotRole, requiredRole: BotRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
  return userLevel >= requiredLevel;
}

export function canStartGame(role: BotRole): boolean {
  return hasPermission(role, BotRole.MODERATOR);
}

export function getRoleFromDiscordRoles(discordRoles: string[]): BotRole {
  const roles = discordRoles.map(r => r.toLowerCase());

  if (roles.includes('owner_role') || roles.includes('server_owner')) {
    return BotRole.OWNER;
  }
  if (roles.includes('admin_role') || roles.includes('admin')) {
    return BotRole.ADMIN;
  }
  if (roles.includes('mod_role') || roles.includes('moderator') || roles.includes('mod')) {
    return BotRole.MODERATOR;
  }
  if (roles.includes('banned_role') || roles.includes('banned')) {
    return BotRole.BANNED;
  }
  return BotRole.PLAYER;
}

export function getRoleName(role: BotRole): string {
  switch (role) {
    case BotRole.OWNER:
      return 'Owner';
    case BotRole.ADMIN:
      return 'Admin';
    case BotRole.MODERATOR:
      return 'Moderator';
    case BotRole.PLAYER:
      return 'Player';
    case BotRole.BANNED:
      return 'Banned';
  }
}

export function getRequiredRoleDisplayName(requiredRole: BotRole): string {
  return getRoleName(requiredRole);
}
