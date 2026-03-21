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
  if (discordRoles.includes('OWNER_ROLE') || discordRoles.includes('SERVER_OWNER')) {
    return BotRole.OWNER;
  }
  if (discordRoles.includes('ADMIN_ROLE') || discordRoles.includes('ADMIN')) {
    return BotRole.ADMIN;
  }
  if (
    discordRoles.includes('MOD_ROLE') ||
    discordRoles.includes('MODERATOR') ||
    discordRoles.includes('MOD')
  ) {
    return BotRole.MODERATOR;
  }
  if (discordRoles.includes('BANNED_ROLE') || discordRoles.includes('BANNED')) {
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
