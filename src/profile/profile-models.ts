// Modelos de presentación del Shell. El adaptador HTTP valida los DTOs del Equipo 1.
export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface CatalogGame {
  gameType: string;
  name: string;
  description: string;
  requiredPermission?: string;
}
