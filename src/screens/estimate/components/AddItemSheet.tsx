import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { BottomSheet } from "../../../design-system/components/overlays/BottomSheet";
import { AppText } from "../../../design-system/components/typography/AppText";
import { TextField } from "../../../design-system/components/forms/TextField";
import { QuantityField } from "../../../design-system/components/forms/QuantityField";
import { SegmentedControl } from "../../../design-system/components/forms/SegmentedControl";
import { PrimaryButton, TertiaryButton } from "../../../design-system/components/actions/Buttons";
import { InlineAlert } from "../../../design-system/components/feedback/Banner";
import { Money } from "../../../design-system/components/data-display/Money";
import { EstimateItemInput, QuoteItemType, QuoteLineItemDTO } from "../../../services/estimate/types";
import { PartsCatalogItemDTO } from "../../../services/workExecution/types";
import { InventoryPicker } from "../../workExecution/components/InventoryPicker";

export interface AddItemSheetProps {
  jobId: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: EstimateItemInput) => void;
  initial?: QuoteLineItemDTO | null;
  submitting: boolean;
  /** Shown inside the sheet: the screen's own error banner sits behind it. */
  errorMessage?: string | null;
}

const CATEGORY_OPTIONS: { value: QuoteItemType; label: string }[] = [
  { value: "labour", label: "Labour" },
  { value: "part", label: "Part" },
  { value: "material", label: "Material" },
  { value: "other", label: "Other" },
];

/** Parts and materials are things the provider stocks, so they are picked from
 * inventory and priced by it. Labour and "other" are the technician's own
 * judgement and stay free-form. */
function isStocked(type: QuoteItemType): boolean {
  return type === "part" || type === "material";
}

/**
 * Parts and materials come from the provider's inventory, at the inventory's
 * customer price -- the same list, at the same price, as a part requested while
 * the job is in progress. Before this they were typed by hand at a typed price,
 * so an estimate could promise a part the provider did not stock at a price the
 * catalogue did not charge, and approval had nothing to reserve.
 *
 * The price shown is display only: the backend reprices every inventory line
 * from the catalogue and ignores whatever the client sends, so this sheet
 * never offers to edit it. Labour is untouched.
 *
 * Editing an existing manual line (labour, "other", or a part typed before this
 * change) keeps the old free-form form, so nothing already on an estimate
 * becomes uneditable.
 */
export function AddItemSheet({ jobId, visible, onClose, onSubmit, initial, submitting, errorMessage }: AddItemSheetProps) {
  const { theme } = useTheme();
  const [itemType, setItemType] = useState<QuoteItemType>(initial?.item_type ?? "labour");
  const [name, setName] = useState(initial?.item_name ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? "1");
  const [unitPrice, setUnitPrice] = useState(initial?.unit_price ?? "");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<PartsCatalogItemDTO | null>(null);
  const [pickedQty, setPickedQty] = useState(1);
  // The screen's last mutation error outlives the sheet; show it only for a
  // submit made while this sheet is open.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setItemType(initial?.item_type ?? "labour");
      setName(initial?.item_name ?? "");
      setQuantity(initial?.quantity ?? "1");
      setUnitPrice(initial?.unit_price ?? "");
      setSearch("");
      setPicked(null);
      setPickedQty(Math.max(1, Math.round(Number(initial?.quantity ?? 1))));
      setSubmitted(false);
    }
  }, [visible, initial]);

  const editing = Boolean(initial);
  const editingInventoryLine = editing && Boolean(initial?.inventory);
  // A new part or material is picked from inventory. An existing manual line
  // is edited the old way, whatever its type.
  const pickFromInventory = !editing && isStocked(itemType);

  const submit = (item: EstimateItemInput) => {
    setSubmitted(true);
    onSubmit(item);
  };

  const errorBanner = submitted && errorMessage ? (
    <View style={{ marginTop: theme.spacing.sm }}>
      <InlineAlert tone="danger" title="Couldn't save this item" message={errorMessage} />
    </View>
  ) : null;

  // ── An inventory line already on the estimate: quantity only ────────────
  if (editingInventoryLine && initial) {
    const unit = Number(initial.unit_price);
    return (
      <BottomSheet visible={visible} onClose={onClose} dismissible={!submitting}>
        <AppText variant="title" style={{ marginBottom: theme.spacing.sm }}>Edit quantity</AppText>
        <View style={{ padding: theme.spacing.md, borderRadius: theme.radiusUsage.card, backgroundColor: theme.colors.surfaceSelected, marginBottom: theme.spacing.sm }}>
          <AppText variant="bodyStrong">{initial.item_name}</AppText>
          <AppText variant="caption" color="secondary">
            {[initial.inventory?.sku, "From inventory"].filter(Boolean).join(" · ")}
          </AppText>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
            <Money amount={unit} />
            <AppText variant="bodySmall" color="secondary">per {initial.inventory?.unit ?? "unit"}</AppText>
          </View>
        </View>
        <AppText variant="caption" color="tertiary" style={{ marginBottom: theme.spacing.sm }}>
          The price is set by your provider's inventory and can't be changed here.
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <QuantityField label="Quantity" value={pickedQty} onChange={setPickedQty} min={1} />
          <View style={{ alignItems: "flex-end", paddingBottom: theme.spacing.sm }}>
            <AppText variant="caption" color="tertiary">Line total</AppText>
            <Money amount={unit * pickedQty} />
          </View>
        </View>
        {errorBanner}
        <View style={{ height: theme.spacing.lg }} />
        <PrimaryButton
          label="Save changes"
          onPress={() => submit({ item_type: initial.item_type, item_name: initial.item_name, quantity: pickedQty, unit_price: unit })}
          disabled={pickedQty < 1}
          loading={submitting}
          fullWidth
        />
      </BottomSheet>
    );
  }

  // ── A new part or material: pick it from inventory ───────────────────────
  if (pickFromInventory) {
    return (
      <BottomSheet visible={visible} onClose={onClose} dismissible={!submitting}>
        <AppText variant="title" style={{ marginBottom: theme.spacing.base }}>Add item</AppText>
        <SegmentedControl options={CATEGORY_OPTIONS} value={itemType} onChange={value => { setItemType(value); setPicked(null); }} />
        <View style={{ height: theme.spacing.base }} />
        {picked ? (
          <View>
            <View style={{ padding: theme.spacing.md, borderRadius: theme.radiusUsage.card, backgroundColor: theme.colors.surfaceSelected, marginBottom: theme.spacing.sm }}>
              <AppText variant="bodyStrong">{picked.name}</AppText>
              <AppText variant="caption" color="secondary">
                {[picked.sku, picked.warranty ? `Warranty ${picked.warranty}` : null].filter(Boolean).join(" · ")}
              </AppText>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: theme.spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs }}>
                  <Money amount={picked.unit_price} />
                  <AppText variant="bodySmall" color="secondary">per {picked.unit}</AppText>
                </View>
                <AppText variant="bodySmall" color="secondary">{picked.available_qty} in stock</AppText>
              </View>
            </View>
            {!submitting ? <TertiaryButton label="Choose a different part" onPress={() => setPicked(null)} /> : null}
            <View style={{ height: theme.spacing.sm }} />
            <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
              <QuantityField
                label="Quantity"
                value={pickedQty}
                onChange={setPickedQty}
                min={1}
                max={picked.max_request_qty}
                helperText={picked.max_request_qty < picked.available_qty ? `Up to ${picked.max_request_qty} from one stock location` : undefined}
              />
              <View style={{ alignItems: "flex-end", paddingBottom: theme.spacing.sm }}>
                <AppText variant="caption" color="tertiary">Customer pays</AppText>
                <Money amount={picked.unit_price * pickedQty} />
              </View>
            </View>
            <AppText variant="caption" color="tertiary" style={{ marginTop: theme.spacing.xs }}>
              Price from your provider's inventory.
            </AppText>
            {errorBanner}
            <View style={{ height: theme.spacing.lg }} />
            <PrimaryButton
              label="Add to estimate"
              onPress={() => submit({
                item_type: itemType, item_name: picked.name, quantity: pickedQty,
                unit_price: picked.unit_price, inventory_item_id: picked.item_id,
              })}
              disabled={pickedQty < 1 || pickedQty > picked.max_request_qty}
              loading={submitting}
              fullWidth
            />
          </View>
        ) : (
          <View>
            <AppText variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>
              Choose from your provider's inventory
            </AppText>
            <InventoryPicker
              jobId={jobId}
              enabled={visible}
              search={search}
              onSearchChange={setSearch}
              onPick={item => { setPicked(item); setPickedQty(1); }}
            />
          </View>
        )}
      </BottomSheet>
    );
  }

  // ── Labour, "other", or an existing manual line: free-form as before ────
  const qtyNum = Number(quantity);
  const priceNum = Number(unitPrice);
  const valid = name.trim().length > 0 && qtyNum > 0 && priceNum >= 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} dismissible={!submitting}>
      <AppText variant="title" style={{ marginBottom: theme.spacing.base }}>{editing ? "Edit item" : "Add item"}</AppText>
      <SegmentedControl options={CATEGORY_OPTIONS} value={itemType} onChange={value => { setItemType(value); setPicked(null); }} disabled={editing} />
      <View style={{ height: theme.spacing.base }} />
      <TextField label="Description" value={name} onChangeText={setName} placeholder="e.g. Gas refill & leak repair" />
      <View style={{ height: theme.spacing.sm }} />
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Unit rate (₹)" value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" />
        </View>
      </View>
      {errorBanner}
      <View style={{ height: theme.spacing.lg }} />
      <PrimaryButton
        label={editing ? "Save changes" : "Add item"}
        onPress={() => submit({ item_type: itemType, item_name: name.trim(), quantity: qtyNum, unit_price: priceNum })}
        disabled={!valid}
        loading={submitting}
        fullWidth
      />
    </BottomSheet>
  );
}
