export type MobileViewMode = 'SYSTEM_ADMIN' | 'ADMIN' | 'MEMBER';

export type AuthUser = {
  userId?: string;
  fullName: string;
  email: string;
  associationRole?: string;
  associationType?: string;
  associationName?: string;
  systemRole?: string;
  isTechy8Admin?: boolean;
  impersonatedBy?: string;
  firstLogin?: boolean;
  associationId?: string;
  schema?: string;
  roles: string[];
  permissions: string[];
};

export type AuthAssociationOption = {
  associationId: string;
  associationName: string;
  schema?: string;
  associationType?: string;
};

export type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  email: string;
  fullName: string;
  userId?: string;
  id?: string;
  associationId?: string;
  associationName?: string;
  associationRole?: string;
  associationType?: string;
  systemRole?: string;
  schema?: string;
  isTechy8Admin?: boolean;
  firstLogin?: boolean;
  roles?: string[];
  permissions?: string[];
  multipleAssociations?: boolean;
  associations?: AuthAssociationOption[];
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type JwtPayload = {
  sub: string;
  fullName?: string;
  associationRole?: string;
  associationType?: string;
  associationName?: string;
  systemRole?: string;
  userId?: string;
  isTechy8Admin?: boolean;
  impersonatedBy?: string;
  firstLogin?: boolean;
  associationId?: string;
  schema?: string;
  roles?: string[];
  permissions?: string[];
  exp?: number;
  iat?: number;
};

