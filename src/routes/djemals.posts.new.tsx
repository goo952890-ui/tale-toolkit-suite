import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCategories, upsertPost } from "@/lib/blog.functions";
import { PostForm } from "@/components/PostForm";

const catQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });

export const Route = createFileRoute("/djemals/posts/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catQ),
  component: NewPost,
});

function NewPost() {
  const { data: cats } = useSuspenseQuery(catQ);
  const save = useServerFn(upsertPost);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">New post</h1>
      <div className="mt-6">
        <PostForm
          categories={cats}
          busy={busy}
          onSubmit={async (values) => {
            setBusy(true);
            try {
              await save({ data: values });
              navigate({ to: "/djemals/posts" });
            } finally { setBusy(false); }
          }}
        />
      </div>
    </div>
  );
}
