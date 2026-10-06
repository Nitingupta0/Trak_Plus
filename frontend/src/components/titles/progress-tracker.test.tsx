import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProgressTracker } from "@/components/titles/progress-tracker";
import type { LibraryEntry, ProgressSummary } from "@/lib/types";

// All I/O is mocked — component tests must never reach the live backend.
vi.mock("@/lib/client/api", () => ({
  bff: vi.fn(),
  publicApi: vi.fn(),
  proxiedImageUrl: vi.fn((url: string | null) => url),
  queries: {
    library: vi.fn(),
    progress: vi.fn(),
    syncEpisodes: vi.fn(),
  },
}));

import { bff, publicApi, queries } from "@/lib/client/api";

const mockedPublicApi = vi.mocked(publicApi);
const mockedBff = vi.mocked(bff);
const mockedLibrary = vi.mocked(queries.library);
const mockedProgress = vi.mocked(queries.progress);

const EPISODES = [
  {
    id: "ep-1",
    number: 1,
    season: 0,
    name: "Enter: Naruto Uzumaki!",
    air_date: null,
    description: "Naruto begins his journey.",
    thumbnail_url: "https://example.com/episode-1.jpg",
  },
  {
    id: "ep-2",
    number: 2,
    season: 0,
    name: "My Name is Konohamaru!",
    air_date: null,
    description: null,
    thumbnail_url: null,
  },
  {
    id: "ep-3",
    number: 3,
    season: 0,
    name: "Sasuke and Sakura",
    air_date: null,
    description: null,
    thumbnail_url: null,
  },
];

const ENTRY: LibraryEntry = {
  id: "entry-1",
  status: "watching",
  rating: null,
  notes: null,
  playtime_minutes: null,
  added_at: "2026-08-30T00:00:00Z",
  updated_at: null,
  title: {
    id: "title-1",
    title: "NARUTO",
    media_type: "anime",
    release_date: null,
    poster_url: null,
    source: "anilist",
    source_id: "20",
  },
};

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(createElement(QueryClientProvider, { client }, ui));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedLibrary.mockResolvedValue([ENTRY]);
  mockedProgress.mockResolvedValue({
    library_entry_id: "entry-1",
    watched_count: 0,
    total_episodes: 3,
    watched_episode_ids: [],
  });
  mockedPublicApi.mockResolvedValue(EPISODES);
});

describe("ProgressTracker", () => {
  it("renders synced episodes with labels and air dates", async () => {
    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    expect(await screen.findByText("Enter: Naruto Uzumaki!")).toBeInTheDocument();
    expect(screen.getByText("E1")).toBeInTheDocument();
    expect(screen.getByTestId("progress-count")).toHaveTextContent("0 / 3");
  });

  it("renders episode descriptions and accessible thumbnail alt text", async () => {
    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    expect(await screen.findByText("Naruto begins his journey.")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute(
      "src",
      "https://example.com/episode-1.jpg",
    );
    expect(
      screen.getByRole("checkbox", { name: /mark enter: naruto uzumaki! as watched/i }),
    ).toBeInTheDocument();
  });

  it("checking an episode calls the BFF and updates the count without reload", async () => {
    const user = userEvent.setup();
    const updated: ProgressSummary = {
      library_entry_id: "entry-1",
      watched_count: 1,
      total_episodes: 3,
      watched_episode_ids: ["ep-1"],
    };
    mockedBff.mockResolvedValue(updated);

    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    const checkbox = await screen.findByTestId("episode-checkbox-1");
    await user.click(checkbox);

    await waitFor(() => expect(mockedBff).toHaveBeenCalled());
    expect(mockedBff).toHaveBeenCalledWith("library/entry-1/progress/ep-1", {
      method: "POST",
    });
    await waitFor(() =>
      expect(screen.getByTestId("progress-count")).toHaveTextContent("1 / 3"),
    );
  });

  it("unchecking an episode issues a DELETE and counts drop", async () => {
    const user = userEvent.setup();
    mockedProgress.mockResolvedValue({
      library_entry_id: "entry-1",
      watched_count: 1,
      total_episodes: 3,
      watched_episode_ids: ["ep-1"],
    });
    mockedBff.mockResolvedValue({
      library_entry_id: "entry-1",
      watched_count: 0,
      total_episodes: 3,
      watched_episode_ids: [],
    });

    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    // Wait for the row to reflect the pre-checked state before interacting.
    const checkbox = await screen.findByTestId("episode-checkbox-1");
    await waitFor(() => expect(checkbox).toBeChecked());
    await user.click(checkbox);

    await waitFor(() =>
      expect(mockedBff).toHaveBeenCalledWith("library/entry-1/progress/ep-1", {
        method: "DELETE",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("progress-count")).toHaveTextContent("0 / 3"),
    );
  });

  it("offers episode sync when none are synced yet", async () => {
    mockedPublicApi.mockRejectedValue(new Error("title not in library cache"));
    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    expect(await screen.findByTestId("sync-episodes")).toBeInTheDocument();
  });

  it("prompts to add the title when there is no library entry", async () => {
    mockedLibrary.mockResolvedValue([]);
    renderWithProviders(
      <ProgressTracker
        source="anilist"
        externalId="20"
        internalTitleId="title-1"
        isEpisodeMedia
      />,
    );
    expect(await screen.findByText(/add this title to your library/i)).toBeInTheDocument();
  });
});
