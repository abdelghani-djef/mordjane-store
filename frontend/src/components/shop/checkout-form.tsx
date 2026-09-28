"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangleIcon, BanknoteIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OrderSummary } from "@/components/shop/cart-view";
import { Alert } from "@/components/shop/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError, type DeliveryCity, type OrderConflict, type OrderCreated } from "@/lib/api";
import { formatPrice, localizedName } from "@/lib/format";
import { hasBlockedLines, useCart, useHydrated } from "@/stores/cart";

const PHONE = /^\+?[0-9 ]{8,20}$/;

function makeSchema(t: ReturnType<typeof useTranslations<"Checkout">>) {
  return z.object({
    customer_name: z.string().trim().min(2, t("errors.name")).max(120),
    phone: z.string().trim().regex(PHONE, t("errors.phone")),
    // Required: the confirmation, tracking code and delivery updates are emailed.
    email: z.string().trim().email(t("errors.email")),
    address: z.string().trim().min(4, t("errors.address")).max(255),
    delivery_city_id: z.string().min(1, t("errors.governorate")),
    delegation_id: z.string().min(1, t("errors.delegation")),
    notes: z.string().max(1000),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const FIELDS = [
  { name: "customer_name", label: "name", autoComplete: "name" },
  { name: "phone", label: "phone", autoComplete: "tel", type: "tel", hint: "phoneHint" },
  { name: "email", label: "email", autoComplete: "email", type: "email", hint: "emailHint" },
  { name: "address", label: "address", autoComplete: "street-address" },
] as const;

/**
 * `cities` are the governorates (they set the delivery fee); the customer then picks one of the
 * chosen governorate's delegations.
 */
export function CheckoutForm({ cities }: { cities: DeliveryCity[] }) {
  const t = useTranslations("Checkout");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const applyProblems = useCart((s) => s.applyProblems);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      customer_name: "",
      phone: "",
      email: "",
      address: "",
      delivery_city_id: "",
      delegation_id: "",
      notes: "",
    },
  });
  // An order needs a delegation, so a governorate without an active one can't be offered.
  const governorates = cities.filter((c) => c.delegations.length > 0);
  const cityId = useWatch({ control: form.control, name: "delivery_city_id" });
  const city = governorates.find((c) => String(c.id) === cityId);
  const collator = new Intl.Collator(locale);
  const delegations = (city?.delegations ?? [])
    .map((d) => ({ id: d.id, name: localizedName(d, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));

  const blocked = hasBlockedLines(lines);

  // Nothing to check out (and not because we just placed the order), or lines that can't be
  // bought → back to the cart, which explains what to fix.
  useEffect(() => {
    if (!hydrated || placed) return;
    if (lines.length === 0 || blocked) router.replace("/cart");
  }, [hydrated, lines.length, blocked, placed, router]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      const order = await api<OrderCreated>("/orders", {
        method: "POST",
        json: {
          ...values,
          delivery_city_id: Number(values.delivery_city_id),
          delegation_id: Number(values.delegation_id),
          locale,
          items: lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity })),
        },
      });
      setPlaced(true);
      clear();
      const phone = values.phone.replace(/\s/g, "");
      router.push({ pathname: "/track", query: { code: order.code, phone, new: "1" } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        applyProblems((error.body as OrderConflict).problems);
        toast.warning(t("stockChanged"));
        router.push("/cart");
        return;
      }
      setSubmitError(error instanceof ApiError ? error.message : t("error"));
    }
  }

  if (!hydrated || ((lines.length === 0 || blocked) && !placed)) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-[28rem] rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const submitting = form.formState.isSubmitting;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]"
    >
      <div className="flex flex-col gap-8 rounded-2xl border bg-card p-5 sm:p-8">
        <FieldSet>
          <FieldLegend className="font-heading text-xl">{t("contact")}</FieldLegend>
          <FieldGroup>
            {FIELDS.map((f) => (
              <Controller
                key={f.name}
                name={f.name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={f.name}>{t(f.label)}</FieldLabel>
                    <Input
                      {...field}
                      id={f.name}
                      type={"type" in f ? f.type : "text"}
                      // Phone numbers and emails read left to right, even on the Arabic shop.
                      dir={"type" in f ? "ltr" : undefined}
                      autoComplete={f.autoComplete}
                      aria-invalid={fieldState.invalid}
                      className="h-10 rtl:text-right"
                    />
                    {"hint" in f && !fieldState.invalid && (
                      <FieldDescription>{t(f.hint)}</FieldDescription>
                    )}
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            ))}
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                name="delivery_city_id"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="delivery_city_id">{t("governorate")}</FieldLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Delegations belong to one governorate: pick again in the new one.
                        form.setValue("delegation_id", "");
                      }}
                      name={field.name}
                    >
                      <SelectTrigger
                        id="delivery_city_id"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        className="h-10 w-full"
                      >
                        <SelectValue placeholder={t("governoratePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {governorates.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {/* Radix renders item content inside an inline span, so align the
                                fees as a column with a fixed-width name instead of flex. */}
                            <span className="inline-block min-w-32 text-start">
                              {localizedName(c, locale)}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatPrice(c.fee, locale)}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="delegation_id"
                control={form.control}
                render={({ field, fieldState }) => {
                  // Until a governorate is picked, its own error says what to do first.
                  const invalid = fieldState.invalid && Boolean(city);
                  return (
                    <Field data-invalid={invalid} data-disabled={!city}>
                      <FieldLabel htmlFor="delegation_id">{t("delegation")}</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        name={field.name}
                        disabled={!city}
                      >
                        <SelectTrigger
                          id="delegation_id"
                          ref={field.ref}
                          onBlur={field.onBlur}
                          aria-invalid={invalid}
                          className="h-10 w-full"
                        >
                          <SelectValue
                            placeholder={t(city ? "delegationPlaceholder" : "delegationFirst")}
                          />
                        </SelectTrigger>
                        {/* Up to ~20 per governorate: sorted, and typing jumps to a name. */}
                        <SelectContent className="max-h-80">
                          {delegations.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : (
                        <FieldDescription>{t("delegationHint")}</FieldDescription>
                      )}
                    </Field>
                  );
                }}
              />
            </div>
            <Controller
              name="notes"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="notes">{t("notes")}</FieldLabel>
                  <Textarea {...field} id="notes" rows={3} />
                </Field>
              )}
            />
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend className="font-heading text-xl">{t("payment")}</FieldLegend>
          <div className="flex items-start gap-4 rounded-xl border-2 border-primary bg-accent/40 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <BanknoteIcon className="size-5" />
            </span>
            <div>
              <p className="font-medium">{t("cod")}</p>
              <p className="text-sm text-muted-foreground">{t("codText")}</p>
            </div>
          </div>
        </FieldSet>
      </div>

      <OrderSummary
        lines={lines}
        deliveryFee={city ? Number(city.fee) : null}
        deliveryNote={tCart("deliveryChooseGovernorate")}
        compact
      >
        {submitError && (
          <Alert icon={<AlertTriangleIcon />} tone="destructive">
            {submitError}
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Spinner /> {t("placing")}
            </>
          ) : (
            t("placeOrder")
          )}
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/cart">{tCart("title")}</Link>
        </Button>
      </OrderSummary>
    </form>
  );
}
