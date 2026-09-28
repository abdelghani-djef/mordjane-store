"use client";

import { MailIcon, PlusIcon, SendIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/admin-shell";
import { ErrorState, errorMessage, LoadingRows } from "@/components/admin/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationSettings,
  useSaveNotificationSettings,
  useSendTestEmail,
} from "@/lib/admin-api";
import type { NotificationSettings, NotificationSettingsIn } from "@/lib/api";

// The form always holds every field (the API fills defaults for missing ones).
type Form = Required<NotificationSettingsIn>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Toggle = {
  [K in keyof Form]: Form[K] extends boolean ? K : never;
}[keyof Form];

const STAFF_EVENTS: Toggle[] = [
  "notify_admin_new_order",
  "notify_admin_status_change",
  "notify_admin_low_stock",
];
const CUSTOMER_EVENTS: Toggle[] = [
  "notify_customer_confirmation",
  "notify_customer_validated",
  "notify_customer_shipped",
  "notify_customer_delivered",
  "notify_customer_cancelled",
];

export default function NotificationsPage() {
  const t = useTranslations("Admin.notifications");
  const settings = useNotificationSettings();

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : settings.isPending ? (
        <LoadingRows rows={8} />
      ) : (
        // Re-mount with fresh values after each save.
        <SettingsForm key={settings.dataUpdatedAt} initial={settings.data} />
      )}
    </>
  );
}

function SettingsForm({ initial }: { initial: NotificationSettings }) {
  const t = useTranslations("Admin.notifications");
  const tCommon = useTranslations("Admin.common");
  const save = useSaveNotificationSettings();
  const { mail_server: server, ...rest } = initial;
  const [values, setValues] = useState<Form>(rest as Form);
  const [newRecipient, setNewRecipient] = useState("");
  const dirty = JSON.stringify(values) !== JSON.stringify(rest);
  const thresholdValid =
    Number.isInteger(values.low_stock_threshold) && values.low_stock_threshold >= 0;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function addRecipient() {
    const email = newRecipient.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      toast.error(t("invalidEmail"));
      return;
    }
    if (!values.admin_recipients.includes(email)) {
      set("admin_recipients", [...values.admin_recipients, email]);
    }
    setNewRecipient("");
  }

  function onSave() {
    save.mutate(values, {
      onSuccess: () => toast.success(t("saved")),
      onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
    });
  }

  const toggle = (key: Toggle) => (
    <Field key={key} orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={key}>{t(`events.${key}.label`)}</FieldLabel>
        <FieldDescription>{t(`events.${key}.hint`)}</FieldDescription>
      </FieldContent>
      <Switch id={key} checked={values[key]} onCheckedChange={(v) => set(key, v)} />
    </Field>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("staffTitle")}</CardTitle>
            <CardDescription>{t("staffHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-recipient">{t("recipients")}</FieldLabel>
                {values.admin_recipients.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {values.admin_recipients.map((email) => (
                      <li
                        key={email}
                        className="flex items-center gap-1 rounded-full border bg-muted py-1 pr-1 pl-3 text-sm"
                      >
                        {email}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="rounded-full"
                          aria-label={`${t("remove")} ${email}`}
                          onClick={() =>
                            set(
                              "admin_recipients",
                              values.admin_recipients.filter((r) => r !== email),
                            )
                          }
                        >
                          <XIcon />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-honey-ink">{t("noRecipients")}</p>
                )}
                <form
                  className="mt-1 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addRecipient();
                  }}
                >
                  <Input
                    id="new-recipient"
                    type="email"
                    placeholder="gerant@exemple.tn"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                  />
                  <Button type="submit" variant="outline" disabled={!newRecipient.trim()}>
                    <PlusIcon /> {t("add")}
                  </Button>
                </form>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-language">{t("language")}</FieldLabel>
                <div className="w-48">
                  <Select
                    value={values.admin_language}
                    onValueChange={(v) => set("admin_language", v as "en" | "fr")}
                  >
                    <SelectTrigger id="admin-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Field>
              {STAFF_EVENTS.map(toggle)}
              <Field data-invalid={!thresholdValid}>
                <FieldLabel htmlFor="threshold">{t("threshold")}</FieldLabel>
                <div className="w-32">
                  <Input
                    id="threshold"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={
                      Number.isNaN(values.low_stock_threshold) ? "" : values.low_stock_threshold
                    }
                    aria-invalid={!thresholdValid}
                    onChange={(e) => set("low_stock_threshold", e.target.valueAsNumber)}
                  />
                </div>
                <FieldDescription>{t("thresholdHint")}</FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t("customerTitle")}</CardTitle>
            <CardDescription>{t("customerHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>{CUSTOMER_EVENTS.map(toggle)}</FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-20">
        <Button
          size="lg"
          className="rounded-full"
          disabled={!dirty || !thresholdValid || save.isPending}
          onClick={onSave}
        >
          {save.isPending && <Spinner />}
          {t("save")}
        </Button>
        {server && <MailServerCard server={server} recipients={values.admin_recipients} />}
      </div>
    </div>
  );
}

function MailServerCard({
  server,
  recipients,
}: {
  server: NonNullable<NotificationSettings["mail_server"]>;
  recipients: string[];
}) {
  const t = useTranslations("Admin.notifications");
  const tCommon = useTranslations("Admin.common");
  const test = useSendTestEmail();
  const [to, setTo] = useState("");
  const isLocal = ["127.0.0.1", "localhost"].includes(server.host);

  function sendTest() {
    const address = to.trim();
    if (address && !EMAIL.test(address)) {
      toast.error(t("invalidEmail"));
      return;
    }
    test.mutate(address ? [address] : undefined, {
      onSuccess: (r) => toast.success(t("testSent", { to: r.sent_to.join(", ") })),
      onError: (e) => toast.error(errorMessage(e, tCommon("error"))),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-lg">
          <MailIcon className="size-5 text-primary" /> {t("serverTitle")}
        </CardTitle>
        <CardDescription>{t("serverHint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">{t("sender")}</dt>
          <dd className="break-all">{server.sender}</dd>
          <dt className="text-muted-foreground">{t("server")}</dt>
          <dd>
            {server.host}:{server.port}
            {!server.enabled && <span className="text-destructive"> ({t("disabled")})</span>}
          </dd>
        </dl>
        {isLocal && (
          <p className="rounded-lg bg-soft p-3 text-soft-foreground">
            {t.rich("localHint", {
              link: (chunks) => (
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        )}
        <Field>
          <FieldLabel htmlFor="test-to">{t("testTo")}</FieldLabel>
          <Input
            id="test-to"
            type="email"
            placeholder={recipients[0] ?? "vous@exemple.tn"}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <FieldDescription>{t("testHint")}</FieldDescription>
        </Field>
        <Button
          variant="outline"
          onClick={sendTest}
          disabled={test.isPending || (!to.trim() && recipients.length === 0)}
        >
          {test.isPending ? <Spinner /> : <SendIcon />}
          {t("sendTest")}
        </Button>
      </CardContent>
    </Card>
  );
}
