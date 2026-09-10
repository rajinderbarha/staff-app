import React from "react";
import { View } from "react-native";
import { useTheme } from "../../../design-system/themes";
import { AppText } from "../../../design-system/components/typography/AppText";
import { AttachmentThumbnail } from "../../../design-system/components/data-display/AttachmentThumbnail";
import { LoadingSpinner } from "../../../design-system/components/feedback/Loading";

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

/** Before/after are always visually distinguished by an explicit label, not
 * color alone (spec section 20). "Before" photos are technician-tagged in
 * this phase -- automatic carryover from inspection evidence was not built
 * (disclosed deviation). */
export function EvidenceGrid({ beforeIds, afterIds, editable, uploadingCategory, onAddBefore, onAddAfter, onRemove }: EvidenceGridProps) {
  const { theme } = useTheme();
  const before = beforeIds ?? [];
  const after = afterIds ?? [];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
      {before.map(id => (
        <AttachmentThumbnail key={`before-${id}`} label="Before" onPress={editable ? () => onRemove("before", id) : undefined} />
      ))}
      {after.map(id => (
        <AttachmentThumbnail key={`after-${id}`} label="After" onPress={editable ? () => onRemove("after", id) : undefined} />
      ))}
      {editable ? (
        uploadingCategory ? (
          <LoadingSpinner />
        ) : (
          <AttachmentThumbnail label="Add photo" onPress={onAddAfter} />
        )
      ) : null}
      {before.length === 0 && after.length === 0 && !editable ? (
        <AppText variant="bodySmall" color="tertiary">No evidence captured.</AppText>
      ) : null}
    </View>
  );
}
