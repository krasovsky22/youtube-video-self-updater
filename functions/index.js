const functions = require('firebase-functions');
const { google } = require('googleapis');

const VIDEO_ID = process.env.VIDEO_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const createYoutubeClient = () => {
  const authClient = new google.auth.OAuth2({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  authClient.setCredentials({ refresh_token: REFRESH_TOKEN });

  return google.youtube({
    auth: authClient,
    version: 'v3',
  });
};

const getVideoData = async (youtubeClient) => {
  const videoResult = await youtubeClient.videos.list({
    id: VIDEO_ID,
    part: 'snippet,statistics',
  });

  const { statistics, snippet } = videoResult.data.items[0];

  return { statistics, snippet };
};

const getVideoComments = async (youtubeClient) => {
  const comments = await youtubeClient.commentThreads.list({
    part: 'snippet,replies',
    videoId: VIDEO_ID,
  });

  return comments.data.items;
};

const updateVideo = async (youtubeClient, snippet) => {
  functions.logger.info('Generating new title', { title: snippet.title });
  return await youtubeClient.videos.update({
    part: 'snippet',
    requestBody: {
      id: VIDEO_ID,
      snippet,
    },
  });
};

const generateNewVideoTitle = ({ statistics, comments }) => {
  const { viewCount, likeCount, dislikeCount } = statistics;
  return `This video has ${viewCount} views and ${comments.length} comments. (Likes: ${likeCount} , Dislikes: ${dislikeCount})`;
};

exports.updateYouTubeVideoTitle = functions.https.onRequest(
  async (request, response) => {
    const youtubeClient = createYoutubeClient();

    const videoData = await getVideoData(youtubeClient);
    functions.logger.info('Video fetched: ', { ...videoData });
    const comments = await getVideoComments(youtubeClient);
    functions.logger.info('Comments fetched: ', [...comments]);
    const newTitle = generateNewVideoTitle({ ...videoData, comments });

    if (videoData.snippet.title === newTitle) {
        functions.logger.info('Title hasnt changed. Exising.');
        response.send({ success: true, message: "Title hasnt changed."});
    }

    await updateVideo(youtubeClient, { ...videoData.snippet, title: newTitle });
    response.send({ success: true, title: newTitle });
  }
);
