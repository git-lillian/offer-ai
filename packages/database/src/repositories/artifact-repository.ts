import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";
import type {
  Artifact,
  ArtifactVersion,
  ArtifactComment,
  ArtifactType,
  ArtifactOrigin,
  ArtifactApprovalState,
} from "@offer-ai/domain";

type Db = SupabaseClient<Database>;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toArtifact(row: Database["public"]["Tables"]["artifacts"]["Row"]): Artifact {
  return {
    id: row.id,
    studentId: row.student_id,
    caseId: row.case_id,
    artifactType: row.artifact_type as ArtifactType,
    title: row.title,
    latestVersionId: row.latest_version_id,
    approvalState: row.approval_state as ArtifactApprovalState,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVersion(
  row: Database["public"]["Tables"]["artifact_versions"]["Row"],
): ArtifactVersion {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    versionNumber: row.version_number,
    content: row.content,
    creatorUserId: row.creator_user_id,
    origin: row.origin as ArtifactOrigin,
    promptVersion: row.prompt_version,
    modelRunId: row.model_run_id,
    evidenceUsed: [...(row.evidence_used ?? [])],
    approvalState: row.approval_state as ArtifactApprovalState,
    createdAt: new Date(row.created_at),
  };
}

function toComment(
  row: Database["public"]["Tables"]["artifact_comments"]["Row"],
): ArtifactComment {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    versionNumber: row.version_number,
    authorUserId: row.author_user_id,
    body: row.body,
    createdAt: new Date(row.created_at),
  };
}

// ── Artifact repository ───────────────────────────────────────────────────────

export class ArtifactRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Artifact | null> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toArtifact(data);
  }

  async listByStudent(studentId: string): Promise<Artifact[]> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toArtifact);
  }

  async listByStudentAndCase(studentId: string, caseId: string): Promise<Artifact[]> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("student_id", studentId)
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toArtifact);
  }

  async listByCase(caseId: string): Promise<Artifact[]> {
    const { data, error } = await this.db
      .from("artifacts")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toArtifact);
  }

  async create(artifact: Artifact): Promise<Artifact> {
    const { data, error } = await this.db
      .from("artifacts")
      .insert({
        id: artifact.id,
        student_id: artifact.studentId,
        case_id: artifact.caseId,
        artifact_type: artifact.artifactType,
        title: artifact.title,
        latest_version_id: artifact.latestVersionId,
        approval_state: artifact.approvalState,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toArtifact(data);
  }

  async update(artifact: Artifact): Promise<Artifact> {
    const { data, error } = await this.db
      .from("artifacts")
      .update({
        title: artifact.title,
        case_id: artifact.caseId,
        artifact_type: artifact.artifactType,
        latest_version_id: artifact.latestVersionId,
        approval_state: artifact.approvalState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", artifact.id)
      .select("*")
      .single();
    if (error) throw error;
    return toArtifact(data);
  }

  // ── Versions ────────────────────────────────────────────────────────────────

  async addVersion(version: ArtifactVersion): Promise<ArtifactVersion> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .insert({
        id: version.id,
        artifact_id: version.artifactId,
        version_number: version.versionNumber,
        content: version.content,
        creator_user_id: version.creatorUserId,
        origin: version.origin,
        prompt_version: version.promptVersion,
        model_run_id: version.modelRunId,
        evidence_used: version.evidenceUsed,
        approval_state: version.approvalState,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toVersion(data);
  }

  async listVersions(artifactId: string): Promise<ArtifactVersion[]> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .select("*")
      .eq("artifact_id", artifactId)
      .order("version_number", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toVersion);
  }

  async findVersionById(versionId: string): Promise<ArtifactVersion | null> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .select("*")
      .eq("id", versionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toVersion(data);
  }

  async getLatestVersion(artifactId: string): Promise<ArtifactVersion | null> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .select("*")
      .eq("artifact_id", artifactId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toVersion(data);
  }

  async getLatestVersionResolved(artifact: Artifact): Promise<ArtifactVersion | null> {
    if (!artifact.latestVersionId) {
      return this.getLatestVersion(artifact.id);
    }
    const version = await this.findVersionById(artifact.latestVersionId);
    if (version) return version;
    return this.getLatestVersion(artifact.id);
  }

  async updateVersionApproval(
    versionId: string,
    approvalState: ArtifactApprovalState,
  ): Promise<ArtifactVersion> {
    const { data, error } = await this.db
      .from("artifact_versions")
      .update({ approval_state: approvalState })
      .eq("id", versionId)
      .select("*")
      .single();
    if (error) throw error;
    const updated = toVersion(data);
    // Keep the parent artifact's approval_state in sync with the latest version.
    await this.db
      .from("artifacts")
      .update({ approval_state: updated.approvalState, updated_at: new Date().toISOString() })
      .eq("id", updated.artifactId);
    return updated;
  }

  // ── Comments ────────────────────────────────────────────────────────────────

  async addComment(comment: ArtifactComment): Promise<ArtifactComment> {
    const { data, error } = await this.db
      .from("artifact_comments")
      .insert({
        id: comment.id,
        artifact_id: comment.artifactId,
        version_number: comment.versionNumber,
        author_user_id: comment.authorUserId,
        body: comment.body,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toComment(data);
  }

  async listComments(artifactId: string, versionNumber?: number): Promise<ArtifactComment[]> {
    let query = this.db
      .from("artifact_comments")
      .select("*")
      .eq("artifact_id", artifactId)
      .order("created_at", { ascending: true });
    if (versionNumber !== undefined) {
      query = query.eq("version_number", versionNumber);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toComment);
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.db.from("artifact_comments").delete().eq("id", commentId);
    if (error) throw error;
  }
}
