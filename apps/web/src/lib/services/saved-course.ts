import "server-only";
import {
  SavedCourseRepository,
  StudentProfileRepository,
} from "@offer-ai/database";
import { NotFoundError, ConflictError } from "@offer-ai/domain";
import { getServerClient } from "@/lib/supabase/server";
import type { SavedCourseRow } from "@offer-ai/database";

export interface SavedCourseWithCourse {
  saved: SavedCourseRow;
  course: {
    id: string;
    title: string;
    slug: string;
    level: string;
    institutionName: string;
    institutionSlug: string;
    institutionCity: string | null;
    tuitionFee: number | null;
    currencyCode: string | null;
  };
}

type CourseWithInstitutionRow = {
  id: string;
  title: string;
  slug: string;
  level: string;
  tuition_fee: number | null;
  currency_code: string | null;
  catalog_institutions: {
    name: string;
    slug: string;
    city: string | null;
  } | null;
};

export class SavedCourseApplicationService {
  async listForUser(userId: string): Promise<SavedCourseWithCourse[]> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found.");
    }

    const repo = new SavedCourseRepository(supabase);
    const saved = await repo.list(profile.id);
    if (saved.length === 0) return [];

    const courseIds = saved.map((s) => s.courseId);
    const { data, error } = await supabase
      .from("catalog_courses")
      .select("id, title, slug, level, tuition_fee, currency_code, catalog_institutions(name, slug, city)")
      .in("id", courseIds);

    if (error) {
      throw new NotFoundError(error.message);
    }

    const courseMap = new Map<string, CourseWithInstitutionRow>();
    for (const row of (data ?? []) as unknown as CourseWithInstitutionRow[]) {
      courseMap.set(row.id, row);
    }

    return saved.map((s) => {
      const course = courseMap.get(s.courseId);
      return {
        saved: s,
        course: course
          ? {
              id: course.id,
              title: course.title,
              slug: course.slug,
              level: course.level,
              institutionName: course.catalog_institutions?.name ?? "Unknown institution",
              institutionSlug: course.catalog_institutions?.slug ?? "",
              institutionCity: course.catalog_institutions?.city ?? null,
              tuitionFee: course.tuition_fee,
              currencyCode: course.currency_code,
            }
          : {
              id: s.courseId,
              title: "Course",
              slug: "",
              level: "undergraduate",
              institutionName: "Unknown institution",
              institutionSlug: "",
              institutionCity: null,
              tuitionFee: null,
              currencyCode: null,
            },
      };
    });
  }

  async saveForUser(userId: string, courseId: string): Promise<SavedCourseRow> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found.");
    }

    // Ensure course exists (public catalogue, RLS-readable)
    const { data: course } = await supabase
      .from("catalog_courses")
      .select("id")
      .eq("id", courseId)
      .maybeSingle();
    if (!course) {
      throw new NotFoundError("Course not found.");
    }

    const repo = new SavedCourseRepository(supabase);
    const already = await repo.isSaved(profile.id, courseId);
    if (already) {
      throw new ConflictError("Course already saved.");
    }

    try {
      return await repo.save(profile.id, courseId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("duplicate") || message.includes("unique")) {
        throw new ConflictError("Course already saved.");
      }
      throw error;
    }
  }

  async unsaveForUser(userId: string, courseId: string): Promise<void> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError("Student profile not found.");
    }

    const repo = new SavedCourseRepository(supabase);
    await repo.unsave(profile.id, courseId);
  }

  async listCourseIdsForUser(userId: string): Promise<string[]> {
    const supabase = await getServerClient();
    const profileRepo = new StudentProfileRepository(supabase);
    const profile = await profileRepo.findByUserId(userId);
    if (!profile) return [];
    const repo = new SavedCourseRepository(supabase);
    return repo.listCourseIds(profile.id);
  }
}

export async function createSavedCourseService(): Promise<SavedCourseApplicationService> {
  return new SavedCourseApplicationService();
}
