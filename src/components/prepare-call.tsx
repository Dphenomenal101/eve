"use client";
import { useState } from "react";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { useEve } from "./eve-provider";
import { Button, Field, Input, Modal } from "./ui";
export function PrepareCall({ accountId }: { accountId: string }) {
  const { command, busy, role } = useEve();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        disabled={role === "viewer"}
        onClick={() => setOpen(true)}
      >
        <Phone size={14} />
        Prepare call
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="A conversation, with permission"
        description="Record the contact’s request or consent. Eve prepares a call plan for review under your current calling policy."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await command({
                type: "prepare_call",
                accountId,
                phone: String(f.get("phone")),
                consent: true,
                consentNote: String(f.get("note")),
              });
              setOpen(false);
              toast.success("Call plan prepared. Review it in Artifacts.");
            } catch {}
          }}
        >
          <Field label="Phone number" hint="Include the country code.">
            <Input
              name="phone"
              type="tel"
              pattern="\+[1-9][0-9]{7,14}"
              required
              placeholder="+14155550100"
            />
          </Field>
          <Field label="How was consent received?">
            <textarea
              className="input"
              name="note"
              required
              minLength={8}
              maxLength={1000}
              placeholder="Requested a call in our support conversation on…"
            />
          </Field>
          <label className="checkbox-label">
            <input type="checkbox" required />
            The contact has agreed to receive this call.
          </label>
          <div className="modal-actions">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={busy}>
              Prepare call plan
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
