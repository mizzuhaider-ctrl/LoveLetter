export type QuestionChoice = 'gf' | 'forever' | 'love' | 'custom';

export type MusicLanguage = 'hindi' | 'english';

export interface LoveProposal {
  id: string;
  recipientName: string;
  yourName: string;
  questionChoice: QuestionChoice;
  customQuestion: string;
  message: string;
  photoUrl?: string;
  songTitle?: string;
  musicLanguage?: MusicLanguage;
  createdAt: number;
  isUnlocked?: boolean;
  slug?: string;
}

export type ViewState = 'creator' | 'proposal' | 'celebration';

export type LegalPageType = 'contact' | 'privacy' | 'terms' | 'refund';
