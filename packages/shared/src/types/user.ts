export interface UserPreferences {
  diet?: string[];
  allergies?: string[];
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  servingSize?: number;
  equipment?: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  imageUrl?: string;
  preferences?: UserPreferences;
}
