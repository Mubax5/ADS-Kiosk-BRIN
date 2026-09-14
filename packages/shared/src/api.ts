import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export type CmsRole = "admin" | "editor";
export type CmsUser = {
  id: string;
  username: string;
  role: CmsRole;
  canPublish: boolean;
};
