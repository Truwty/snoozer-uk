"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { folderEdit, type FolderEdit } from "@/lib/media-folders";
import { profileRevisionNumber } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";
import type { ActionState } from "@/lib/actions";

const nameError = "Enter a folder name between 1 and 60 characters. Unfiled is reserved.";
const staleError = "This media library changed. Review the latest version before trying again.";
const errorState = (message: string): ActionState => ({ status: "error", message });

export async function changeMediaFolders(scope: string, revision: number, input: FolderEdit): Promise<ActionState> {
  const edit = folderEdit.safeParse(input);
  if (!edit.success) return errorState(edit.error.issues[0]?.path[0] === "name" ? nameError : "Invalid folder change.");
  if (!z.uuid().safeParse(scope).success || !profileRevisionNumber.safeParse(revision).success) return errorState(staleError);
  const { client } = await requireAccount();
  const change = edit.data;
  const { data, error } = await client.rpc("edit_media_folders", {
    p_scope: scope, p_expected: revision, p_operation: change.operation,
    p_id: "id" in change ? change.id : null,
    p_name: "name" in change ? change.name : null,
    p_folder: "folder" in change ? change.folder : null,
  });
  if (error) return errorState("Couldn’t save that folder change. Try again.");
  if (data === "invalid_name") return errorState(nameError);
  if (data === "duplicate") return errorState("You already have a folder with that name.");
  if (data === "limit") return errorState("You can create up to 12 folders.");
  if (data === "changed" || data === "not_found") {
    revalidatePath("/studio/gallery/folders");
    return errorState(staleError);
  }
  if (data !== "saved") return errorState("Couldn’t save that folder change.");
  revalidatePath("/studio/gallery/folders");
  const messages = {
    create: "Folder created.", rename: "Folder renamed.", delete: "Folder deleted. Its images are now unfiled.", move: "Image location saved.",
  };
  return { status: "success", message: messages[change.operation] };
}
