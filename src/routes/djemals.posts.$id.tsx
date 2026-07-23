import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPostById, listCategories, upsertPost } from "@/lib/blog.functions";
import { PostForm } from "@/components/PostForm";

const catQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const postQ = (id: string) => queryOptions({ queryKey: ["admin", "post", id], queryFn: () => getPostById({ data: { id } }) });

export const Route = createFileRoute("/djemals/posts/$id")({
  loader: async ({ context, params }) => {
    context.queryClient.ensureQueryData(catQ);
    const p = await context.queryClient.ensureQueryData(postQ(params.id));
    if (!p) throw notFound();
  },
  component: EditPost,
});

function EditPost() {
  const { id } = Route.useParams();
  const { data: cats } = useSuspenseQuery(catQ);
  const { data: post } = useSuspenseQuery(postQ(id));
  const save = useServerFn(upsertPost);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!post) return null;
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Edit post</h1>
      <div className="mt-6">
        <PostForm
          categories={cats}
          busy={busy}
          initial={post}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              await save({ data: { ...values, id } });
              navigate({ to: "/djemals/posts" });
            } finally { setBusy(false); }
          }}
        />
      </div>
    </div>
  );
}
