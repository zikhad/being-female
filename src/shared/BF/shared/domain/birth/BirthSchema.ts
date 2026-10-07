import type { AuthoritativeBirthState } from "@shared/domain/birth/BirthState";
import { nonNegativeInteger, object, optional, string } from "@shared/validation/Schema";

/** Runtime schema for persisted and networked birth lifecycle state. */
export const birthStateSchema = object<AuthoritativeBirthState>({
	birthSequence: nonNegativeInteger,
	pendingBirthId: optional(string({ minimumLength: 1, maximumLength: 128 })),
	completedBirthId: optional(string({ minimumLength: 1, maximumLength: 128 }))
});
