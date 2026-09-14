import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { BottomSheet } from "../../../design-system/components/overlays/BottomSheet";
import { AppText } from "../../../design-system/components/typography/AppText";
import { SearchField } from "../../../design-system/components/forms/SearchField";
import { QuantityField } from "../../../design-system/components/forms/QuantityField";
import { TextArea } from "../../../design-system/components/forms/TextArea";
import { PrimaryButton, TertiaryButton } from "../../../design-system/components/actions/Buttons";
import { InlineAlert } from "../../../design-system/components/feedback/Banner";
import { EmptyState, RetryState } from "../../../design-system/components/feedback/States";
import { Skeleton } from "../../../design-system/components/feedback/Loading";
import { Money } from "../../../design-system/components/data-display/Money";
import { CreatePartsRequestBody, PartsCatalogItemDTO } from "../../../services/workExecution/types";
import { usePartsCatalog } from "../usePartsCatalog";

export interface RequestPartSheetProps {
  jobId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (body: CreatePartsRequestBody) => void;
  submitting: boolean;
  /** Shown inside the sheet: the screen's own error banner sits behind it. */
  errorMessage?: string | null;
}

/**
 * The technician picks a part from the provider's inventory -- never types
 * one in. Name and customer price come from that catalogue, so the backend
 * sends the request straight to the customer's chat for approval; the
 * technician never approves their own request (spec sections 10, 25).
 */
export function RequestPartSheet({ jobId, visible, onClose, onSubmit, submitting, errorMessage }: RequestPartSheetProps) {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PartsCatalogItemDTO | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  // The screen's last mutation error outlives the sheet; show it only for a
  // submit made while this sheet is open.
  const [submitted, setSubmitted] = useState(false);
  const catalog = usePartsCatalog(jobId, search, visible);

  useEffect(() => {
    if (visible) {
      setSearch("");
      setSelected(null);
      setQuantity(1);
      setReason("");
      setSubmitted(false);
    }
  }, [visible]);

  const choose = (item: PartsCatalogItemDTO) => {
    setSelected(item);
    setQuantity(1);
  };

  const valid = selected !== null && quantity >= 1 && quantity <= selected.max_request_qty && reason.trim().length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissible={!submitting}>
      {selected ? (
        <View>
          <AppText variant="title" style={{ marginBottom: theme.spacing.sm }}>Request part</AppText>
          <View style={{ padding: theme.spacing.md, borderRadius: theme.radiusUsage.card, backgroundColor: theme.colors.surfaceSelected, marginBottom: theme.spacing.sm }}>
            <AppText variant="bodyStrong">{selected.name}</AppText>
            <AppText variant="caption" color="secondary">
              {[selected.sku, selected.warranty ? `Warranty ${selected.warranty}` : null].filter(Boolean).join(" · ")}
            </AppText>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: theme.spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs }}>
                <Money amount={selected.unit_price} />
                <AppText variant="bodySmall" color="secondary">per {selected.unit}</AppText>
              </View>
              <AppText variant="bodySmall" color="secondary">{selected.available_qty} in stock</AppText>
            </View>
          </View>
          {!submitting ? <TertiaryButton label="Change part" onPress={() => setSelected(null)} /> : null}
          <View style={{ height: theme.spacing.sm }} />
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
            <QuantityField
              label="Quantity"
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={selected.max_request_qty}
              helperText={selected.max_request_qty < selected.available_qty ? `Up to ${selected.max_request_qty} from one stock location` : undefined}
            />
            <View style={{ alignItems: "flex-end", paddingBottom: theme.spacing.sm }}>
              <AppText variant="caption" color="tertiary">Customer pays</AppText>
              <Money amount={selected.unit_price * quantity} />
            </View>
          </View>
          <View style={{ height: theme.spacing.sm }} />
          <TextArea label="Reason" value={reason} onChangeText={setReason} placeholder="Why is this part needed?" minLines={3} />
          <View style={{ height: theme.spacing.sm }} />
          <InlineAlert tone="neutral" message="The customer is asked to approve this part in their chat before you fit it." />
          {submitted && errorMessage ? (
            <View style={{ marginTop: theme.spacing.sm }}>
              <InlineAlert tone="danger" title="Couldn't send request" message={errorMessage} />
            </View>
          ) : null}
          <View style={{ height: theme.spacing.base }} />
          <PrimaryButton
            label="Send to customer"
            onPress={() => {
              setSubmitted(true);
              onSubmit({ inventory_item_id: selected.item_id, quantity, reason: reason.trim() });
            }}
            disabled={!valid}
            loading={submitting}
            fullWidth
          />
        </View>
      ) : (
        <View>
          <AppText variant="title">Choose a part</AppText>
          <AppText variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>From your provider's inventory</AppText>
          <SearchField label="Search parts" value={search} onChangeText={setSearch} onClear={() => setSearch("")} placeholder="Name or SKU" />
          <View style={{ height: theme.spacing.sm }} />
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {catalog.isLoading ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Skeleton height={56} />
                <Skeleton height={56} />
                <Skeleton height={56} />
              </View>
            ) : catalog.isError ? (
              <RetryState title="Couldn't load inventory" message={catalog.error?.safeMessage} onRetry={() => catalog.refetch()} />
            ) : catalog.items.length === 0 ? (
              catalog.searchTerm ? (
                <EmptyState icon="search-outline" title="No matching parts" message={`Nothing in your provider's inventory matches "${catalog.searchTerm}".`} />
              ) : (
                <EmptyState icon="construct-outline" title="No parts in inventory" message="Ask your provider to add parts to their inventory, then try again." />
              )
            ) : (
              catalog.items.map(item => {
                const outOfStock = item.max_request_qty <= 0;
                return (
                  <Pressable
                    key={item.item_id}
                    onPress={() => choose(item)}
                    disabled={outOfStock}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    accessibilityState={{ disabled: outOfStock }}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
                      paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xs,
                      borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
                      backgroundColor: pressed ? theme.colors.surfaceInteractive : "transparent",
                      opacity: outOfStock ? theme.opacity.disabled : 1,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{item.name}</AppText>
                      <AppText variant="caption" color="tertiary">{[item.sku, item.category].filter(Boolean).join(" · ")}</AppText>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Money amount={item.unit_price} />
                      <AppText variant="caption" color={outOfStock ? "danger" : "secondary"}>
                        {outOfStock ? "Out of stock" : `${item.available_qty} in stock`}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}
    </BottomSheet>
  );
}
