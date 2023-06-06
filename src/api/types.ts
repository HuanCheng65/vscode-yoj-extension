/* eslint-disable @typescript-eslint/naming-convention */
export interface LoggedInUser {
	status: boolean;
	uid?: string;
	username?: string;
	nickname?: string;
	message?: string;
}

export interface LoginResult {
	status: number;
}

export interface Submission {
	id: number;
	problemId: number;
	problemName: string;
	status: string;
	score: number;
	runTime: string;
	memory: string;
	language: string;
	codeLength: string;
	submitter: string;
	submitTime: string;
}

export interface Problem {
	id: number;
	name: string;
	difficulty: number;
	keywords: string;
}

export interface SubmitResult {
	status: number;
	// Failed
	info?: string;
	// Success
	submissionId?: number;
}

export enum ProblemType {
	Normal = 0,
	FillInTheBlank = 1,
}

export interface SupportLanguage {
	name: string;
	value: string;
	mode: string;
	extension: string;
}

export interface ProblemDetail {
	id: number;
	name: string;
	type: ProblemType;
	memoryLimit: string;
	timeLimit: string;
	descriptionText: string;
	descriptionHtml: string;
	uploader: string;
	// Normal
	supportLanguages?: Array<SupportLanguage>;
	// FillInTheBlank
	blankCount?: number;
	useCompiler?: string;
	codeTemplate?: string;
}

export interface SubmissionDetail {
	submission: Submission
}