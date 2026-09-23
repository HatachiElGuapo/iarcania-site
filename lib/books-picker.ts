import { db } from "@/lib/db/client";
import { books } from "@/lib/db/schema/libros";
import { asc, eq } from "drizzle-orm";

export type BookOption = { id: string; title: string; author: string | null };

// Libros del usuario, para vincular un item de cola de Fases a un libro
// de Libros — ver <QueueItemRow>.
export function listBookOptions(userId: string): Promise<BookOption[]> {
  return db
    .select({ id: books.id, title: books.title, author: books.author })
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(asc(books.title));
}
