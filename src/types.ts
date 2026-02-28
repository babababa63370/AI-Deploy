export interface Deployment {
  id: string;
  name: string;
  source: string;
  status: "Deploying" | "Running" | "Failed" | "Stopped" | "Healing";
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  domain?: string;
  port: number;
  logs: string[];
  error?: string;
  createdAt: Date | string;
}

export interface AIAnalysisResult {
  installCommand: string;
  buildCommand: string;
  startCommand: string;
  explanation: string;
}

export interface Settings {
  cf_token: string;
  cf_zone: string;
}
