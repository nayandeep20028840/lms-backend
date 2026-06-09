require('dotenv').config();
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { createPresignedPost } = require('@aws-sdk/s3-presigned-post');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const defaultProvider = require('../common/defaultProvider');
const baseLogger = require('./logger');

const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: defaultProvider
});

const convertS3LinkToCloudfrontOrReverseProxyLink = (s3Link) => {
    const s3BucketName = process.env.STORAGE_BUCKET;
    const s3BaseUrl = process.env.S3_BASE_URL;
    const s3Region = process.env.S3_REGION;

    if (s3BaseUrl && s3Region) {
        s3Link = s3Link.replace(s3BucketName, s3BaseUrl);
        s3Link = s3Link.replace('.s3.' + s3Region + '.amazonaws.com', '');
    }

    return s3Link;
};

async function uploadPresignedUrl(key, contentType) {
    const Logger = baseLogger.createChild({ serviceName: 'S3 get signed url' });
    try {
        const { url, fields } = await createPresignedPost(s3Client, {
            Bucket: process.env.STORAGE_BUCKET,
            Key: key,
            Conditions: [
                { 'Content-Type': contentType || 'application/octet-stream' },
                ['content-length-range', 1, 104857600],
            ],
            Fields: {
                'Content-Type': contentType || 'application/octet-stream',
            },
            Expires: 600,
        });

        Logger.info('Presigned POST generated', { url, fields });

        const convertedUrl = convertS3LinkToCloudfrontOrReverseProxyLink(url);
        Logger.info('Converted URL', convertedUrl);

        return { success: true, uploadUrl: convertedUrl, fields };
    } catch (error) {
        Logger.error('Error uploading to S3', error);
        return { success: false, message: error };
    }
}

async function getPresignedUrl(key) {
    const Logger = baseLogger.createChild({ serviceName: 'S3 get signed url' });
    const getParams = {
        Bucket: process.env.STORAGE_BUCKET,
        Key: key
    };

    let getUrl = await getSignedUrl(s3Client, new GetObjectCommand(getParams));
    const s3CloudfrontUrl = process.env.S3_CLOUDFRONT_URL;
    const s3Region = process.env.S3_REGION;
    if (s3CloudfrontUrl && s3Region) {
        getUrl = getUrl.replace(`https://${process.env.STORAGE_BUCKET}.s3.${s3Region}.amazonaws.com`, s3CloudfrontUrl);
    }
    Logger.info('Converted URL', getUrl);

    return getUrl;
}

module.exports = {
    uploadPresignedUrl,
    getPresignedUrl
};
