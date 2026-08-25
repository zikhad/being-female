import { getPlayer, sendClientCommand } from "@asledgehammer/pipewrench";
import { BF_NETWORK_MODULE, BF_PROTOCOL_SCHEMA_VERSION, BFNetworkCommand } from "@constants";
import { BFConvertCondomRequest } from "@shared/BFProtocol";

/** Publishes one server-authoritative request to convert a currently owned condom. */
export class CondomPublisher {
	private nextRevision = 1;

	/** Requests conversion of one condom currently owned by the authenticated server player. */
	public convert(): void {
		const revision = this.nextRevision++;
		const request: BFConvertCondomRequest = {
			schemaVersion: BF_PROTOCOL_SCHEMA_VERSION,
			requestId: `condom-${revision}`,
			revision,
			data: {}
		};
		sendClientCommand(
			getPlayer(),
			BF_NETWORK_MODULE,
			BFNetworkCommand.CONVERT_CONDOM_REQUEST,
			request
		);
	}
}
