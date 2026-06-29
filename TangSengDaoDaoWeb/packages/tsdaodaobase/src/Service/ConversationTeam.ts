import { Channel } from "wukongimjssdk";
import WKApp from "../App";

export interface ConversationTeamItem {
    team_id: number;
    channel_id: string;
    channel_type: number;
    top_order?: number;
    version?: number;
}

export interface ConversationTeam {
    id: number;
    name: string;
    sort_no: number;
    version?: number;
    items?: ConversationTeamItem[];
}

export interface ConversationTeamState {
    teams: ConversationTeam[];
    items: ConversationTeamItem[];
}

export class ConversationTeamService {
    public static shared = new ConversationTeamService()

    async sync(): Promise<ConversationTeamState> {
        const resp = await WKApp.apiClient.get("conversation/teams");
        return {
            teams: resp?.teams || [],
            items: resp?.items || [],
        }
    }

    async create(name: string): Promise<ConversationTeam> {
        return WKApp.apiClient.post("conversation/teams", { name });
    }

    async rename(teamID: number, name: string): Promise<ConversationTeam> {
        return WKApp.apiClient.put(`conversations/teams/${teamID}`, { name });
    }

    async delete(teamID: number): Promise<void> {
        return WKApp.apiClient.delete(`conversations/teams/${teamID}`);
    }

    async move(channel: Channel, teamID: number): Promise<void> {
        return WKApp.apiClient.post(`conversations/teams/${teamID}/items`, {
            channel_id: channel.channelID,
            channel_type: channel.channelType,
        });
    }

    async remove(channel: Channel): Promise<void> {
        return WKApp.apiClient.delete(`conversations/teams/items/${channel.channelID}/${channel.channelType}`);
    }
}
