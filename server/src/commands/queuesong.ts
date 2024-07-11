import { parseHTML } from 'linkedom';
import { SECOND_MS } from '../constants';
import { addSongToPlaybackQueue } from '../handlers/spotify/addSongToPlaybackQueue';
import { getTrack } from '../handlers/spotify/getTrack';
import type { BotCommand } from '../types';
import { hasBotCommandParams } from './helpers/hasBotCommandParams';
import { sendChatMessage } from './helpers/sendChatMessage';

export const queuesong: BotCommand = {
  command: ['queuesong', 'qs', 'sr', 'songrequest'],
  id: 'queuesong',
  cooldown: 10 * SECOND_MS,
  privileged: true,
  description: 'Add a song to the playback queue (on Spotify)',
  callback: async (connection, parsedCommand) => {
    if (hasBotCommandParams(parsedCommand.parsedMessage)) {
      // Get the track input from the command params (the bit after the command)
      const trackInput = parsedCommand.parsedMessage.command.botCommandParams;

      // Define the start of a spotify url and uri
      const openSpotifyTrackUrl = 'https://open.spotify.com/track/';
      const spotifyLinkUrl = 'https://spotify.link/';
      const trackStart = 'spotify:track:';

      // By default, assume the user has pasted a spotify uri, extract the track id
      let trackId = trackInput.slice(trackStart.length);

      // If the user has pasted an open.spotify.com url, extract the track id
      if (trackInput.startsWith(openSpotifyTrackUrl)) {
        trackId = trackInput.slice(openSpotifyTrackUrl.length);

        // If the url has a query string, remove it
        if (trackId.includes('?')) {
          trackId = trackId.split('?')[0];
        }
      }

      // If the user has pasted a spotiy.link url, make a request to the spotify.link api to get the track id
      if (trackInput.startsWith(spotifyLinkUrl)) {
        const spotifyLinkUrlResponse = await fetch(trackInput);

        if (spotifyLinkUrlResponse.status !== 200) {
          sendChatMessage(connection, `Something went wrong adding the song to the queue yogieiDerpula. Try again?`);
          return;
        }

        const htmlResponse = await spotifyLinkUrlResponse.text();
        const actionHref = parseHTML(htmlResponse).window.document.querySelector('a.action')?.getAttribute('href');

        if (!actionHref) {
          sendChatMessage(connection, `Something went wrong adding the song to the queue yogieiDerpula. Try again?`);
          return;
        }

        // trackId format will be like track/trackId?_branch_referrer=stuff
        trackId = actionHref.split('/')[1].split('?')[0];
      }

      // If the input is neither a url or a uri, send a message to the chat and exit
      if (!trackInput.startsWith(trackStart) && !trackInput.startsWith(openSpotifyTrackUrl) && !trackInput.startsWith(spotifyLinkUrl)) {
        sendChatMessage(
          connection,
          `That doesn't look right... yogieiDerpula it needs to be like ${trackStart}stuff, or ${openSpotifyTrackUrl}stuff, or ${spotifyLinkUrl}stuff`,
        );
        return;
      }

      // Get the track from spotify
      const track = await getTrack(trackId);

      // Check if the song is playable in the streamer's country
      if (track && !track.is_playable) {
        sendChatMessage(connection, `Song "${track.name}" is not available for me yogieiDerpula`);
        return;
      }

      // Check if today is a Thursday and if the song is newer than 2010
      const today = new Date();
      const isThursday = today.getDay() === 4;
      const isSongNewerThan2010 = track && new Date(track.album.release_date).getFullYear() > 2010;
      if (isThursday && isSongNewerThan2010) {
        sendChatMessage(connection, `It's Thursday, no songs after 2010!`);
        return;
      }
      
      // Add the track to the playback queue
      const songAddedToQueue = await addSongToPlaybackQueue(`${trackStart}${trackId}`);

      // If the track is not added to the queue, send a message to the chat and exit
      if (!songAddedToQueue) {
        sendChatMessage(connection, `Something went wrong adding the song to the queue yogieiDerpula. Try again?`);
        return;
      }

      // If the track is not found, send a message to the chat and exit
      if (!track) {
        sendChatMessage(connection, `Song added to queue yogieiJAM`);
        return;
      }

      // If the track is found, send a message to the chat and exit
      const trackArtists = track.artists.map((artist) => artist.name).join(', ');
      sendChatMessage(connection, `Song "${track.name} - ${trackArtists}" added to the queue yogieiJAM`);
    }
  },
};
