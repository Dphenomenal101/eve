"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Modal } from "./ui";
import { useEve } from "./eve-provider";
export function PageControls({ pageId }: { pageId: string }) {
  const { data, command, demo, role } = useEve();
  const [open, setOpen] = useState(false);
  const page = data.pageSpecs.find((p) => p.id === pageId);
  if (!page || page.status !== "published") return null;
  return (
    <div className="step-buttons">
      <a
        href={`${demo ? "/preview" : "/p"}/${page.slug}${demo ? "?demo=1" : ""}`}
        className="btn btn-secondary"
        target="_blank"
        rel="noreferrer"
      >
        Open published page ↗
      </a>
      <Button disabled={role === "viewer"} onClick={() => setOpen(true)}>
        Unpublish
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Unpublish this page?"
        description="Its public link will stop serving all published revisions. The artifact and audit history stay available."
      >
        <div className="modal-actions">
          <Button onClick={() => setOpen(false)}>Keep published</Button>
          <Button
            variant="danger"
            onClick={() =>
              void command({ type: "unpublish", pageId })
                .then(() => {
                  setOpen(false);
                  toast.success("Page unpublished.");
                })
                .catch(() => {})
            }
          >
            Unpublish page
          </Button>
        </div>
      </Modal>
    </div>
  );
}
