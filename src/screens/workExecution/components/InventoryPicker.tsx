import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { AppText } from "../../../design-system/components/typography/AppText";
import { SearchField } from "../../../design-system/components/forms/SearchField";
import { EmptyState, RetryState } from "../../../design-system/components/feedback/States";
import { Skeleton } from "../../../design-system/components/feedback/Loading";
import { Money } from "../../../design-system/components/data-display/Money";
import { PartsCatalogItemDTO } from "../../../services/workExecution/types";
import { usePartsCatalog } from "../usePartsCatalog";

export interface InventoryPickerProps {
  jobId: string;
  /** Load only while the host sheet is open. */
  enabled: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPick: (item: PartsCatalogItemDTO) => void;
}

/**
 * The provider's inventory, as a searchable list a technician picks from.
 *
 * Shared by the mid-job parts request and the estimate on purpose: both are
 * answers to "which part, at what price", and they must draw on the same
 * catalogue at the same customer price. When each screen kept its own list, the
 * estimate had none at all and parts were typed in by hand.
 *
 * A part whose largest single stock location is empty cannot be picked, because
 * approving it reserves from one location -- `max_request_qty`, not the total
 * across locations, is what can actually be fulfilled.
 */
export function InventoryPicker({ jobId, enabled, search, onSearchChange, onPick }: InventoryPickerProps) {
  const { theme } = useTheme();
  const catalog = usePartsCatalog(jobId, search, enabled);

  return (
    <View>
      <SearchField label="Search parts" value={search} onChangeText={onSearchChange} onClear={() => onSearchChange("")} placeholder="Name or SKU" />
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
                onPress={() => onPick(item)}
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
  );
}
