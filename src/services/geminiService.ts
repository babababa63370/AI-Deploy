import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeProject(
  source: string,
): Promise<AIAnalysisResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following project source or description and provide the necessary commands to install dependencies, build, and run it. 
    Source/Description: ${source}
    
    If it's a GitHub URL, infer the likely tech stack from the URL or common patterns. If it's a description, use that.
    Provide the response in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          installCommand: {
            type: Type.STRING,
            description:
              "Command to install dependencies (e.g., npm install, pip install -r requirements.txt)",
          },
          buildCommand: {
            type: Type.STRING,
            description:
              "Command to build the project (e.g., npm run build, docker build . -t app). If no build step is needed, return an empty string.",
          },
          startCommand: {
            type: Type.STRING,
            description:
              "Command to start the project (e.g., npm start, python main.py)",
          },
          explanation: {
            type: Type.STRING,
            description:
              "A brief explanation of why these commands were chosen.",
          },
        },
        required: [
          "installCommand",
          "buildCommand",
          "startCommand",
          "explanation",
        ],
      },
    },
  });

  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr);
}

export async function generateLogs(
  command: string,
  projectContext: string,
): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a realistic sequence of 5-10 terminal log lines that would appear when running the command "${command}" for a project described as "${projectContext}".
    Return ONLY a JSON array of strings, where each string is a log line. Do not include markdown formatting or any other text.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
      },
    },
  });

  const jsonStr = response.text?.trim() || "[]";
  return JSON.parse(jsonStr);
}

export async function suggestFix(
  errorLogs: string,
  projectContext: string,
  currentCommands: any,
): Promise<{
  suggestedCommands?: {
    installCommand?: string;
    buildCommand?: string;
    startCommand?: string;
  };
  explanation: string;
}> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The deployment of a project failed. 
    Project Context: ${projectContext}
    Current Commands: ${JSON.stringify(currentCommands)}
    Error Logs:
    ${errorLogs}
    
    Analyze the error and suggest a fix. You can suggest changing the install, build, or start commands.
    Provide the response in JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedCommands: {
            type: Type.OBJECT,
            properties: {
              installCommand: { type: Type.STRING },
              buildCommand: { type: Type.STRING },
              startCommand: { type: Type.STRING },
            },
          },
          explanation: {
            type: Type.STRING,
            description: "Explanation of the error and the proposed fix.",
          },
        },
        required: ["explanation"],
      },
    },
  });

  const jsonStr = response.text?.trim() || "{}";
  return JSON.parse(jsonStr);
}
