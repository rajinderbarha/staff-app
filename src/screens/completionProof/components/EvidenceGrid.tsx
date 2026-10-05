import React, { useState } from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { AppText } from "../../../design-system/components/typography/AppText";
import { AttachmentThumbnail } from "../../../design-system/components/data-display/AttachmentThumbnail";
import { LoadingSpinner } from "../../../design-system/components/feedback/Loading";
import { ConfirmationDialog } from "../../../design-system/components/overlays/ConfirmationDialog";
import { useEvidencePreview } from "../../../services/media/useEvidencePreview";

export interface EvidenceGridProps {
  /** Null when the backend has never stored a list for this proof. Treated as
   * empty -- mapping it directly crashed the whole screen through the error
   * boundary, which is a poor trade for a photo list nobody had filled in. */
  beforeIds: string[] | null;
  afterIds: string[] | null;
  editable: boolean;
  uploadingCategory: "before" | "after" | null;
  onAddBefore: () => void;
  onAddAfter: () => void;
  onRemove: (category: "before" | "after", fileId: string) => void;
}

type Category = "before" | "after";

/** One photo tile showing the real image once its private preview loads. */
function EvidenceThumb({ category, fileId, onPress }: { category: Category; fileId: string; onPress?: () => void }) {
  const uri = useEvidencePreview(fileId);
  const label = category === "before" ? "Before" : "After";
  return (
    <AttachmentThumbnail
      uri={uri}
      label={label}
      accessibilityLabel={onPress ? `${label} photo, tap to remove` : undefined}
      onPress={onPress}
    />
  );
}

/** Before/after are always visually distinguished by an explicit label, not
 * color alone (spec section 20). Removing a photo asks first: a tap on a
 * thumbnail used to delete it outright, so trying to look at a photo lost it. */
export function EvidenceGrid({ beforeIds, afterIds, editable, uploadingCategory, onAddBefore, onAddAfter, onRemove }: EvidenceGridProps) {
  const { theme } = useTheme();
  const [pendingRemoval, setPendingRemoval] = useState<{ category: Category; fileId: string } | null>(null);
  const before = beforeIds ?? [];
  const after = afterIds ?? [];

  const thumb = (category: Category, id: string) => (
    <EvidenceThumb
      key={`${category}-${id}`}
      category={category}
      fileId={id}
      onPress={editable ? () => setPendingRemoval({ category, fileId: id }) : undefined}
    />
  );

  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {before.map(id => thumb("before", id))}
        {after.map(id => thumb("after", id))}
        {editable ? (
          uploadingCategory ? (
            <LoadingSpinner />
          ) : (
            <>
              <AttachmentThumbnail label="Add before" onPress={onAddBefore} />
              <AttachmentThumbnail label="Add after" onPress={onAddAfter} />
            </>
          )
        ) : null}
        {before.length === 0 && after.length === 0 && !editable ? (
          <AppText variant="bodySmall" color="tertiary">No evidence captured.</AppText>
        ) : null}
      </View>
      <ConfirmationDialog
        visible={pendingRemoval !== null}
        title="Remove this photo?"
        message="It will be taken off this job's completion proof."
        confirmLabel="Remove photo"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          if (pendingRemoval) onRemove(pendingRemoval.category, pendingRemoval.fileId);
          setPendingRemoval(null);
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </>
  );
}
