import "server-only";

import {
  ArtifactRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "@offer-ai/domain";
import {
  createArtifact,
  createVersion,
  approveVersion,
  rejectVersion,
  createComment,
} from "@offer-ai/domain";
import type {
  Artifact,
  ArtifactVersion,
  ArtifactComment,
  ArtifactType,
} from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function requireStudentProfile(supabase: ServerClient, userId: string) {
  const profileRepo = new StudentProfileRepository(supabase);
  const profile = await profileRepo.findByUserId(userId);
  if (!profile) {
    throw new NotFoundError("Student profile not found. Complete onboarding first.");
  }
  return profile;
}

async function assertArtifactOwnership(
  supabase: ServerClient,
  userId: string,
  artifactId: string,
): Promise<{ artifact: Artifact; studentId: string }> {
  const profile = await requireStudentProfile(supabase, userId);
  const repo = new ArtifactRepository(supabase);
  const artifact = await repo.findById(artifactId);
  if (!artifact) {
    throw new NotFoundError("Artifact not found.");
  }
  if (artifact.studentId !== profile.id) {
    throw new AuthorizationError("You do not have access to this artifact.");
  }
  return { artifact, studentId: profile.id };
}

export class ArtifactApplicationService {
  constructor(private readonly supabase: ServerClient) {}

  async listForUser(userId: string): Promise<Artifact[]> {
    const profile = await requireStudentProfile(this.supabase, userId);
    const repo = new ArtifactRepository(this.supabase);
    return repo.listByStudent(profile.id);
  }

  async getByIdForUser(
    userId: string,
    artifactId: string,
  ): Promise<{ artifact: Artifact; versions: ArtifactVersion[]; comments: ArtifactComment[] }> {
    const { artifact } = await assertArtifactOwnership(this.supabase, userId, artifactId);
    const repo = new ArtifactRepository(this.supabase);
    const [versions, comments] = await Promise.all([
      repo.listVersions(artifact.id),
      repo.listComments(artifact.id),
    ]);
    return { artifact, versions, comments };
  }

  async createForUser(
    userId: string,
    input: { artifactType: ArtifactType; title: string; caseId?: string | null },
  ): Promise<Artifact> {
    const profile = await requireStudentProfile(this.supabase, userId);
    const artifact = createArtifact({
      studentId: profile.id,
      caseId: input.caseId ?? null,
      artifactType: input.artifactType,
      title: input.title,
    });
    const repo = new ArtifactRepository(this.supabase);
    return repo.create(artifact);
  }

  async createVersionForUser(
    userId: string,
    artifactId: string,
    input: {
      content: string;
      origin: ArtifactVersion["origin"];
      promptVersion?: string | null;
      modelRunId?: string | null;
      evidenceUsed?: string[];
    },
  ): Promise<ArtifactVersion> {
    const { artifact } = await assertArtifactOwnership(this.supabase, userId, artifactId);
    const repo = new ArtifactRepository(this.supabase);
    const latest = await repo.getLatestVersion(artifact.id);
    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

    const version = createVersion(
      {
        artifactId: artifact.id,
        content: input.content,
        creatorUserId: userId,
        origin: input.origin,
        promptVersion: input.promptVersion ?? null,
        modelRunId: input.modelRunId ?? null,
        evidenceUsed: input.evidenceUsed ?? [],
      },
      nextVersionNumber,
    );

    return repo.addVersion(version);
  }

  async approveVersionForUser(
    userId: string,
    artifactId: string,
    versionId: string,
  ): Promise<ArtifactVersion> {
    const { artifact } = await assertArtifactOwnership(this.supabase, userId, artifactId);
    const repo = new ArtifactRepository(this.supabase);
    const version = await repo.findVersionById(versionId);
    if (!version) {
      throw new NotFoundError("Version not found.");
    }
    if (version.artifactId !== artifact.id) {
      throw new ValidationError("Version does not belong to this artifact.");
    }
    const approved = approveVersion(version);
    return repo.updateVersionApproval(approved.id, approved.approvalState);
  }

  async rejectVersionForUser(
    userId: string,
    artifactId: string,
    versionId: string,
  ): Promise<ArtifactVersion> {
    const { artifact } = await assertArtifactOwnership(this.supabase, userId, artifactId);
    const repo = new ArtifactRepository(this.supabase);
    const version = await repo.findVersionById(versionId);
    if (!version) {
      throw new NotFoundError("Version not found.");
    }
    if (version.artifactId !== artifact.id) {
      throw new ValidationError("Version does not belong to this artifact.");
    }
    const rejected = rejectVersion(version);
    return repo.updateVersionApproval(rejected.id, rejected.approvalState);
  }

  async addCommentForUser(
    userId: string,
    artifactId: string,
    input: { versionNumber: number; body: string },
  ): Promise<ArtifactComment> {
    const { artifact } = await assertArtifactOwnership(this.supabase, userId, artifactId);
    const repo = new ArtifactRepository(this.supabase);
    const versions = await repo.listVersions(artifact.id);
    const maxVersion = versions.length > 0 ? Math.max(...versions.map((v) => v.versionNumber)) : 0;
    if (input.versionNumber < 1 || (maxVersion > 0 && input.versionNumber > maxVersion)) {
      // Allow commenting on upcoming version if no versions yet? But validate minimally.
      // If no versions, require versionNumber 1.
      if (maxVersion === 0 && input.versionNumber !== 1) {
        throw new ValidationError("Version does not exist for this artifact.");
      }
      if (maxVersion > 0 && input.versionNumber > maxVersion) {
        throw new ValidationError("Version does not exist for this artifact.");
      }
    }
    const comment = createComment({
      artifactId: artifact.id,
      versionNumber: input.versionNumber,
      authorUserId: userId,
      body: input.body,
    });
    return repo.addComment(comment);
  }
}

export async function createArtifactService(): Promise<ArtifactApplicationService> {
  const supabase = await getServerClient();
  return new ArtifactApplicationService(supabase);
}
