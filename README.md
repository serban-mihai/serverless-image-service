# Serverless Image-Service

The project is inspired by [Serverless Sharp](https://github.com/venveo/serverless-sharp) but doesn't seem to be maintained anymore. The core features have been kept, with some bugs being fixed while other features being temporarily cut. Some might be reintroduced in near future releases.
With this solution, you can get your image service without relying on other paid solutions from Cloud providers such as [CloudFlare](https://www.cloudflare.com/products/cloudflare-images/), [Akamai](https://developer.akamai.com/akamai-image-and-video-manager), [Imgix](https://imgix.com/) to name a few.

The advantages of having your custom solution are flexibility, lower costs, and customization.

## Table of Content
- [Serverless Image-Service](#serverless-image-service)
  - [Table of Content](#table-of-content)
  - [About](#about)
    - [Public S3 Bucket](#public-s3-bucket)
    - [Caching Strategy](#caching-strategy)
    - [Routes](#routes)
      - [GET - List Images](#get---list-images)
      - [GET - Get Image](#get---get-image)
        - [Supported Query Parameters](#supported-query-parameters)
          - [Resizing Operations | Docs](#resizing-operations--docs)
          - [Image Operations | Docs](#image-operations--docs)
          - [Color Manipulation | Docs](#color-manipulation--docs)
          - [Channel Manipulation | Docs](#channel-manipulation--docs)
          - [Compositing Images | Docs](#compositing-images--docs)
          - [Output Options | Docs](#output-options--docs)
        - [Use Cases Examples](#use-cases-examples)
          - [Examples - Resizing Operations](#examples---resizing-operations)
          - [Examples - Image Operations](#examples---image-operations)
          - [Examples - Color Manipulation](#examples---color-manipulation)
          - [Examples - Channel Manipulation](#examples---channel-manipulation)
          - [Examples - Compositing Images](#examples---compositing-images)
          - [Examples - Output Options](#examples---output-options)
      - [POST - Upload Images](#post---upload-images)
      - [DELETE - Remove Image](#delete---remove-image)
  - [Setup](#setup)
    - [Debugging](#debugging)
  - [Local Development](#local-development)
  - [How to Deploy](#how-to-deploy)
  - [Differences from Venveo's service](#differences-from-venveos-service)
    - [Improvements](#improvements)
    - [TODO](#todo)
  - [Consuming The Service Client-Side](#consuming-the-service-client-side)
  - [Limits](#limits)
  - [How to Contribute](#how-to-contribute)

## About

The service is meant to be consumed from both a client App to fetch images from the GET route, and a CMS to manage static assets by uploading and removing them from an **AWS S3 Bucket** through the POST and DELETE routes.
It is capable of storing incoming binary data and serving outcoming images with additional processing for size and quality on-demand. Image processing is handled by the [Sharp](https://github.com/lovell/sharp) library.

### Public S3 Bucket
Warning, this is enabled by default, if you deploy your **S3 Bucket** will have Host for Static Site enabled and access will be public!
Currently, I'm investigating how to **bypass the Lambda triggers** if the request has no query parameters aka. it doesn't require any processing over the image requested. Something might be achievable by **tweaking the API Gateway config** but I don't have a certain answer yet.
Anyway, the service is going to perfectly work with a private **S3 Bucket**, you can disable this by commenting the following lines in `serverless.yml` before deploying:
```
WebsiteConfiguration:
    IndexDocument: " "
PublicAccessBlockConfiguration:
    BlockPublicAcls: false
    BlockPublicPolicy: false
    IgnorePublicAcls: false
    RestrictPublicBuckets: false
``` 
Alternatively, you can comment just the first 2 lines to disable Static Hosting and change the remaining values to be `true`

### Caching Strategy
The only CDN solution offered by this service is `AWS CloudFront`, which serves as **Caching** place for avoiding useless stress on `Lambda` in case of high traffic aka. many requests at once, `Lambda`'s free tier might be generous with 1M requests/month free, but why waste them? 
If you have access to an external CDN that can also **Cache** content from the Origin then it would be a good idea to register your `CloudFront` distribution as **Proxy** to a DNS and Cache there as well successful responses.

Depending on costs on both sides and overall traffic, by using this strategy you could easily use the entire solution for free!
More about this in my [article](https://serbanmihai.com/quests/serverless-image-service#) 

### Routes
| Method   | Route     | Description                            | Content-Type In                         | Content-Type Out                | CORS            | Cache     | Lambda                         |
| -------- | --------- | -------------------------------------- | --------------------------------------- | ------------------------------- | --------------- | --------- | ------------------------------ |
| `GET`    | `/`       | [List Images](#get---list-images)      | `not-required`                          | `application/json`              | `none`          | `none`    | `image-service-<stage>-list`   |
| `GET`    | `/{any+}` | [Get Image](#get---get-image)          | `not-required`                          | `image/*` or `application/json` | `none`          | `2592000` | `image-service-<stage>-get`    |
| `POST`   | `/{any+}` | [Upload Images](#post---upload-images) | `multipart/form-data` or `not-required` | `application/json`              | `CUSTOM_DOMAIN` | `none`    | `image-service-<stage>-post`   |
| `DELETE` | `/{any+}` | [Remove Image](#delete---remove-image) | `not-required`                          | `application/json`              | `CUSTOM_DOMAIN` | `none`    | `image-service-<stage>-delete` |

#### GET - List Images
Gets a list of all the images in the **S3 Bucket** (currently limited to 1000 keys). It has been designed for **debugging purposes only**, but can be extended to list subpaths as well as being so integrated into CMS workflows.
> `GET` https://domain.com/

**It responds with:**
- 🟢 Success: 
  ```
  [
    {
      "Key": "path/image-second.png",
      "LastModified": "2022-04-15T13:35:23.000Z",
      "ETag": "\"firstimageetagrandomhsh123456789\"",
      "ChecksumAlgorithm": [],
      "Size": 182728,
      "StorageClass": "STANDARD"
    },
    {
      "Key": "image.jpg",
      "LastModified": "2022-04-15T13:35:22.000Z",
      "ETag": "\"secondimageetagrandomhsh12345678\"",
      "ChecksumAlgorithm": [],
      "Size": 403063,
      "StorageClass": "STANDARD"
    },
    {
      "Key": "random/path/image-third.png",
      "LastModified": "2022-04-15T13:35:23.000Z",
      "ETag": "\"thirdtimageetagrandomhsh98765432\"",
      "ChecksumAlgorithm": [],
      "Size": 1599028,
      "StorageClass": "STANDARD"
    },
    {
      ...
    }
  ]
  ```
- 🔴 Error:
  ```
  {
    "name": "S3Exception",
    "status": 404,
    "code": "NoSuchBucket",
    "message": "The specified bucket does not exist"
  }
  ```

#### GET - Get Image
This endpoint has 2 purposes, based on receiving query parameters or not:
- `Without query params`: It returns the original file from the key provided (path + filename)
- `With query params`: Attempts to fetch the original file and processes it based on what options are supported before returning it.

For some codec and config reasons, some formats that are applied `q=70` or higher, output a bigger size image than the original.
> `GET` https://domain.com/random/path/image.jpg

> `GET` https://domain.com/random/path/image.jpg?w=300&h=150&q=65&fm=webp

**It responds with:**
- 🟢 Success:
- <p align="left"><img src="https://images.unsplash.com/photo-1616007211778-ab0921a264e8?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=350&q=80" width="350px"></p>
  
- 🔴 Error:
  ```
  {
    "name": "S3Exception",
    "status": 404,
    "code": "NoSuchKey",
    "message": "The specified key does not exist."
  }
  ```
  ```
  {
    "status": 500,
    "code": "internal-error",
    "message": "Error: Expected positive integer for height but received -350 of type number"
  }
  ```

##### Supported Query Parameters
Currently, the following query parameters are supported:
###### Resizing Operations | [Docs](https://sharp.pixelplumbing.com/api-resize)
- `w=<Integer>`: [📝](https://sharp.pixelplumbing.com/api-resize#resize) | A positive number of **px** that represents the new **width** which the image is requested to scale at
- `h=<Integer>`: [📝](https://sharp.pixelplumbing.com/api-resize#resize) | A positive number of **px** that represents the new **height** which the image is requested to scale at
 
###### Image Operations | [Docs](https://sharp.pixelplumbing.com/api-operation)
- `r=<Integer>`: [📝](https://sharp.pixelplumbing.com/api-operation#rotate) | An integer number that represents the **rotation degree** at which the image will be rotated. Negative numbers allowed for counter-clockwise rotations.
- `flip=<Boolean>`: [📝](https://sharp.pixelplumbing.com/api-operation#flip) | If true will **mirror** the image on the **Y axis**
- `flop=<Boolean>`: [📝](https://sharp.pixelplumbing.com/api-operation#flop) | If true will **mirror** the image on the **X axis**
- `af=<Array>`: [📝](https://sharp.pixelplumbing.com/api-operation#affine) | If a valid `Array` is passed will perform an **affine transform** on the image based on offset values inside the `Array`
- `afbg=<String>`: [📝](https://sharp.pixelplumbing.com/api-operation#parameters-4) | The **background in Hex** for the affine transform, defaults to full black `#000000`
- `afi=<String>`: [📝](https://sharp.pixelplumbing.com/api-operation#parameters-4) | The Interpolator for the affine transform, can be one of `nearest`, `bilinear`, `bicubic`, `locallyBoundedBicubic`, `nohalo`, `vertexSplitQuadraticBasisSpline`. It defaults to `bicubic`
- `sh=<Object>`: [📝](https://sharp.pixelplumbing.com/api-operation#sharpen) | **Sharpen** the image, requires a valid JSON Object as value, more details about individual keys in the Docs
- `md=<Integer>`: [📝](https://sharp.pixelplumbing.com/api-operation#median) | Apply a **Median filter** over the image. Value is an `integer`, represents the square mask NxN 
- `bl=<Float>`: [📝](https://sharp.pixelplumbing.com/api-operation#blur) | **Blur** the image by the value, which represents the **sigma** of the Gaussian mask. Values accepted in the range 0.3 and 1000, `float` or `integer` types.
- `fl=<String>`: [📝](https://sharp.pixelplumbing.com/api-operation#flatten) | **Flatten**, merge alpha transparency channel, if any, with a background, then remove the alpha channel. Value is a **Hex color**
- `gm=<Array>`: [📝](https://sharp.pixelplumbing.com/api-operation#gamma) | **Gamma** correction. Value is an `array of floats`, first element is `gamma in` second is `gamma out`
- `ng=<Boolean>`: [📝](https://sharp.pixelplumbing.com/api-operation#negate) | Produces the **Negative** of the image. Value is a `boolean`
- `nr=<Boolean>`: [📝](https://sharp.pixelplumbing.com/api-operation#normalize) | **Normalize** output image contrast by stretching its luminance to cover the full dynamic range, Value is a `boolean` 
- `cl=<Object>`: [📝](https://sharp.pixelplumbing.com/api-operation#clahe) | Enhance the clarity of the image by bringing out darker details through **Clahe**. Value is an Object with `width` `height` and optional `maxSlope` params. More in the Docs
- `cv=<Object>`: [📝](https://sharp.pixelplumbing.com/api-operation#convolve) | **Convolve** with a specific kernel, more about value in Docs
- `th=<Integer>`: [📝](https://sharp.pixelplumbing.com/api-operation#threshold) | Any pixel value greater than or equal to the **Threshold** value will be set to 255, otherwise it will be set to 0
- `bo=<Object>`: [📝](https://sharp.pixelplumbing.com/api-operation#boolean) | Perform a bitwise **Boolean** operation with operand image. you can pass `and`, `or` and `eor` as `operator`, and a link to an image to fetch to `operand`. Doesn't support local files yet
- `li=<Array>`: [📝](https://sharp.pixelplumbing.com/api-operation#linear) | Apply the **Linear** formula a * input + b to the image (levels adjustment)
- `rc=<Array>`: [📝](https://sharp.pixelplumbing.com/api-operation#recomb) | **Recomb** the image with the specified matrix.
- `mo=<Object>`: [📝](https://sharp.pixelplumbing.com/api-operation#modulate) | **Modulate** transform the image using brightness, saturation, hue rotation, and lightness. See Object structure in Docs

###### Color Manipulation | [Docs](https://sharp.pixelplumbing.com/api-colour)

###### Channel Manipulation | [Docs](https://sharp.pixelplumbing.com/api-channel)

###### Compositing Images | [Docs](https://sharp.pixelplumbing.com/api-composite)
- `wm=<String>` [📝](https://sharp.pixelplumbing.com/api-composite#composite) | The name of the **Watermark** to be applied over the image. Static assets must be stored inside the `src/assets` directory
- `gr=<String>` [📝](https://sharp.pixelplumbing.com/api-composite#parameters) | The **position** where to apply the Watermark on the original image. Defaults to `southwest`, other positions are described as cardinal points, `northeast`, `west`, `center`...

###### Output Options | [Docs](https://sharp.pixelplumbing.com/api-resize)
- `q=<Integer>`: A positive number **between 1 and 100** that represents the new **quality** which the image is requested to be compressed at
- `fm=<String>`: [📝](https://sharp.pixelplumbing.com/api-output#toformat) | The name of the format you want to convert the original image, if not supported returns the original format with other eventual optimizations applied. Still experimental, stating to [Sharp Docs](https://sharp.pixelplumbing.com/api-output) you can pass the following values: `jpeg`, `png`, `webp`, `gif`, `jp2` (not yet supported), `tiff`, `avif`, `heif`, `raw`,
- `ll=<Boolean>`: It allows to enable **Lossless** Compression when available, you can pass booleans `true` or `false` or integers `0` or `1`. It defaults to `false` if not passed or other stranger values are detected.

Since these parameters can be chained into one request, their actions need to coexist in the final image. Some rules apply when for example you get both `w` and `h` in the same request, or when you have just one of them but also `q`
> Order doesn't matter between Query Parameters

##### Use Cases Examples
###### Examples - Resizing Operations
- `/path/image.jpg?w=500`: Will scale down `image.jpg` **width** to **500px** if its original width is higher, if the original width is lower, will NOT scale up, it will skip resizing maintaining aspect-ratio. Height is downscaled progressively in proportion to the new width
- `/path/image.jpg?h=500`: Same as above but this time comparisons and dimensions are related to `image.jpg` **heights**
- `/path/image.jpg?w=500&h=100`: Unless the values provided are not complementary related to the originals, this will crop `image.jpg` to be **500px width** and **100px height**. If any of the values is bigger than its original counterpart resize is skipped and the original image is returned

###### Examples - Image Operations
- `/path/image.jpg?r=33`: Will rotate `image.jpg` of **33 degrees clockwise**. Warning, the canvas containing the image will scale to new dimensions to include the whole image corners!
- `/path/image.jpg?r=-75`: Will rotate `image.jpg` of **75 degrees counter-clockwise**. Same warning as above applies here as well
- `/path/image.jpg?flip=true&flop=1`: Will mirror `image.jpg` on **both X and Y axis** (diagonal mirror). You can pass both `true` `false` and `0` `1` values 
- `/path/image.jpg?af=[[1,0.3],[0.1,0.7]]`: Will perform an **affine transform** over `image.jpg`
- `/path/image.jpg?af=[[1,0.3],[0.1,0.7]]&afbg=#FFFFFF`: Will perform an affine transform over `image.jpg` and convert the background to full white `#FFFFFF` 
- `/path/image.jpg?af=[[1,0.3],[0.1,0.7]]&afi=locallyBoundedBicubic`: Will perform an affine transform over `image.jpg` and apply an interpolator of `lbb` 
- `/path/image.jpg?sh={"sigma":2,"m1":0,"m2":3,"x1":3,"y2":15,"y3":15}`: Will **Sharpen** `image.jpg` based on the parameters contained in the value Object
- `/path/image.jpg?md=10`: Apply **Median** filter over `image.jpg`
- `/path/image.jpg?bl=2.2`: **Blur** `image.jpg` with a sigma of `2.2` 
- `/path/image.jpg?fl=#F0A703`: Apply **Flatten** filter over `image.jpg` mergin alpha transparency with color `#F0A703` (yellowish)
- `/path/image.jpg?gm=[2.2,2.1]`: Apply **Gamma** correction of `2.2` input and `2.3` output on `image.jpg`
- `/path/image.jpg?ng=true`: Get the **Negative** of `image.jpg`
- `/path/image.jpg?nr=true`: Apply **Normalize** for full dynamic range luminance over `image.jpg`
- `/path/image.jpg?cl={"width":3,"height":3}`: Apply histogram equalization **Clahe** over `image.jpg` 
- `/path/image.jpg?cv={"width":3,"height":3,"kernel":[-1,0,1,-2,0,2,-1,0,1]}`: Apply **Convolve** over `image.jpg` with custom kernel values
- `/path/image.jpg?th=128`: All pixels from `image.jpg` >= 125 **Threshold** will get a 255 value
- `/path/image.jpg?bo={"operator":"and","source":"https://random.domain.com/path/imageToMerge.jpg"}`: Will **Boolean** merge `image.jpg` and the `imageToMerge.jpg` fetched from the `source` url because of the `and` operator. This feature is error prone, mignt be buggy.
- `/path/image.jpg?li=[1.0,0.0]`: Will pass 1.0 as `a` and 0.0 as `b` to the **Linear** formula `a * input + b` over `image.jpg`
- `/path/image.jpg?rc=[[0.3588,0.7044,0.1368],[0.2990,0.5870,0.1140],[0.2392,0.4696,0.0912]]`: **Recomb** `image.jpg` to match the matrix of values provided
- `/path/image.jpg?mo={"brightness":0.5,"saturation":0.5,"hue":90}`: **Modulate** explicit values `brightness`, `saturation` and `hue` over `image.jpg`
- 
###### Examples - Color Manipulation

###### Examples - Channel Manipulation

###### Examples - Compositing Images
- `/path/image.jpg?wm=companyLogo.png&gr=southwest`: Applies the `companyLogo.png` watermark over `image.jpg` in `southwest` position aka. bottom-left. Pro-tip, leave some padding when designing the watermark, currently there is no offset option that works with `gravity`

###### Examples - Output Options
- `/path/image.jpg?q=57`: This will reduce the **quality** of `image.jpg` by **43%** before returning it. No scaling is applied
- `/path/image.jpg?w=250&q=30`: For last, it will attempt to scale down `image.jpg` to **250px width** (with height proportionally scaled-down as well) and then reduce the quality of the scaled image by **70%**
- `/path/image.jpg?w=100&fm=webp&ll=true`: Resizes `image.jpg` to **100px width** with proportional height and converts it to be in `webp` format, enabling **lossless** convertion.

#### POST - Upload Images
Uploads one or many images to a specific path inside an **S3 Bucket**. Once provided `/path/to/upload` the function will attempt to upload all the files provided under it, if any of the selected filenames are already contained inside the same path, it will throw a conflict error.

Note that this endpoint is supposed to receive a `Content-Type: multipart/form-data` payload format to work but this depends on the library or tool you use to make the request.
If using `fetch` or [Thunder](https://www.thunderclient.com/) for example you won't have to add the `Content-Type` header at all, since they handle the situation in the background, the header itself also contains a boundary that is used to mark the beginning and the end of the payload, as well as distinguish the various files, or parts, which it's composed of.
You'll still have to pass a **binary** of `multipart/form-data` as body on your request though.

The structure of the payload on the client-side looks like this:
```
{
  data: ImageBuffer.jpg
  data: ImageSecondBuffer.png
  data: ImageThirdBuffer.webp
  data: ...
}
```
The key for the `multipart/form-data` has to **always** be `data` because other metadata such as name and extension are already contained within the ImageBuffer that is in this case the binary representation of the image we want to upload, and they will be parsed back by Lambda once received in a correct form.

There are many ways to construct a valid payload compatible but it differs from the client App and its libraries.
> An example with **React/Next.js** is provided in the [related paragraph](#consuming-the-service-client-side)

The raw data, once reaches Lambda, due to API Gateway [policy](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings-workflow.html), it **forcefully encodes** the request body into `base64`, forcing Lambda to **decode it back** into `binary` if we want to parse it further from it's `multipart/form-data` format.
I still haven't found a hack for this, avoiding useless data transformation would be ideal since it would be less prone to bad parsing.

Once the data gets parsed, it's directly written on the **S3 Bucket** from the **Buffer** within the RAM, without being written on Lambda's ephemeral storage first.
> `POST` https://domain.com/random/path/

**It responds with:**
- 🟢 Success: 
  ```
  {
    "status": 200,
    "code": "success",
    "message": "Images uploaded successfully!",
    "ETags": [
      {
        "link": "https://domain.com/random/path/image.jpg",
        "ETag": "firstimageetagrandomhsh123456789"
      },
      {
        "link": "https://domain.com/random/path/image-second.png",
        "ETag": "secondimageetagrandomhsh12345678"
      },
      {
        "link": "https://domain.com/random/path/image-third.webp",
        "ETag": "thirdtimageetagrandomhsh98765432"
      },
      {
        ...
      }
    ]
  }
  ```
- 🔴 Error:
  ```
  {
    "status": 400,
    "code": "internal-error",
    "message": "Malformed or missing incoming data"
  }
  ```
  ```
  {
    "status": 409,
    "code": "already-exists",
    "message": "Images [ image.jpg, image-second.png, ... ] already exist within the requested path /random/path"
  }
  ```

#### DELETE - Remove Image
Removes the image that corresponds to the key (path + filename) provided with the request. It can delete just one file per call, if the key isn't available will throw an error, if the file has been deleted will return a successful message.
> `DELETE` https://domain.com/random/path/image.jpg

**It responds with:**
- 🟢 Success: 
  ```
  {
    status: 200,
    code: "success",
    message: "Image removed successfully!",
  }
  ```
- 🔴 Error:
  ```
  {
    "status": 404,
    "code": "not-found",
    "message": "No image exists under the requested path"
  }
  ```
## Setup

Clone and install NPM dependencies:
- `git clone https://github.com/serban-mihai/serverless-image-service.git`
- `cd serverless-image-service && npm i`

There are a couple of things to be done **before deploying**:
1. Create an AWS Certificate in [ACM](https://aws.amazon.com/certificate-manager/) on the `us-east-1` region that belongs to your `domain.com` and register the `CNAME` inside your external CDN or in [Route53](https://aws.amazon.com/route53/). Also, remember to apply the necessary adjustments to your CDN for SSL/TLS traffic to avoid funky responses from API Gateway
2. Adjust `example-s3-bucket-policy.json` by changing the `<CUSTOM_DOMAIN>` with your `domain.com`. You will have multiple files for different environments if you use different domains or subdomains
3. Copy `example.settings.yml` to `settings.yml` and adjust missing values such as the `region`, `CUSTOM_DOMAIN`, and `ACM_CERTIFICATE_ARN` which is the ID of the Cert you created at step one. Note that the `SOURCE_BUCKET` and `CUSTOM_DOMAIN` will have to be equal within the same stage
4. Make sure not to already have an S3 Bucket on AWS with the same name of `CUSTOM_DOMAIN`
5. `Optional` Place inside `src/assets/` any **Watermark** of your choice to apply it further over images.
6. `Optional` If you don't want to include **GET** (List), **POST** and **DELETE** routes deployed you can just comment them in `serverless.yml`. That will just deploy the **GET** that will serve assets to clients, leaving up to you to upload manually assets within the `S3 Bucket` or integrate this operation with another service.

The reason we are creating the Certificate in `us-east-1` is that for some reason AWS won't accept to create resources in other regions such as `eu-central-1` if the Certificate also belongs in `eu-central-1`
After the above points are checked everything should be ready to go for [deployment](#how-to-deploy).
- After `CloudFormation Stack` deploys, register a `CNAME` of the created `CloudFront Distribution` within your **external CDN DNS** or **Route53** and **Proxy** traffic through it. The `distribution` looks like: `randomhash0123.cloudfront.net`. 

### Debugging
To debug endpoints I recommend the [Thunder Client](https://www.thunderclient.com/) extension for VSCode, it's feature-rich and has everything you need to send requests and debug endpoints. If you don't find yourself comfortable you can also use **Postman** instead, or `curl` if you're a true hardcore!

You can find both Thunder and Postman Collections and Environment in their directories inside the repo, they have predefined requests that cover all the functionality of the service, import them and change the environment accordingly with your **domain**, **path**, and **filename**

## Local Development

Before running the localhost environment consider importing into either **Thunder** or **Postman** their corresponding Collections and Environments.
You can keep the `*-local.json` and change just **filename** and **path** as you debug.

For local development `serverless-offline` plugin is used, to use it you first need to [Deploy](#how-to-deploy) it. After the deployment succeeds, you can run `sls offline --stage <YOUR_STAGE>` or from NPM `npm run offline:<YOUR_STAGE>` and use Thunder or Postman against the `local` Environment.

## How to Deploy

To deploy the app you can either use `sls deploy --stage <YOUR_STAGE>` if you have Serverless installed Globally, or use the NPN script desired you can find in `package.json`, ex `npm run deploy:dev` will deploy on **dev** environment.

At first, deployment is going to take a bit longer, future redeploys will end faster. If an error is returned while deploying, before swearing, you can check your stack in `AWS CloudFormation`, under events there is a remote chance to find something useful.
If this doesn't help feel free to open an issue 😁

If you plan to debug your remote environments (dev, staging, prod) you can use the **Thunder** and **Postman** Collections with the `*-prod.json` environment.
Just make sure to adjust the values for the env variables before.

## Differences from Venveo's service

Along with the edits to almost all the code structure, there are still a couple of things unchanged such as the security chunk.
### Improvements
- Switched from Object-Oriented to Functional programming paradigm
- Updated dependencies and Serverless version to V3
- Removed deprecated code on both Node and Serverless sides
- Included `upload`, `delete` and `list` of static assets
- S3 Bucket and Policy are created at deploy time based on the custom domain you want the service to run on
- Query params parser corrector, all defined query params (w, h, q) are recognized and applied to the returned image
- Fixed images paths without query params not being displayed
- Fixed image scale-up when `w=` and/or `h=` values are higher than the original image's width and/or height
- Packaged just the essential files within Lambdas
- Added Thunder Client and Postman Collections for easy debugging
- Removed Tests

### TODO
What needs to be addressed soon:
- [ ] Add support for remaining [Resizing Operations](https://sharp.pixelplumbing.com/api-resize)
- [x] Add support for [Image Operations](https://sharp.pixelplumbing.com/api-operation)
- [ ] Add support for [Color Manipulation](https://sharp.pixelplumbing.com/api-colour)
- [ ] Add support for [Channel Manipulation](https://sharp.pixelplumbing.com/api-channel)
- [ ] Add Images under each option in the Docs
- [ ] Allow `Base64` encoding for long and explicit param values (Arrays and Objects)
- [ ] Create presets for popular transforms that can be applied all at once with a special query param and have priority over other query parameters
- [ ] Extend `DELETE` endpoint to remove multiple assets at once, similar to `POST` but reversed.
- [x] Personal favourite, add watermark with custom position, can be achieved with [Compositing](https://sharp.pixelplumbing.com/api-composite)
- [ ] Find a way to bypass Lambda when no query params are detected by API Gateway and get the asset from S3 Static Site (requires public access)
- [ ] Test the security `s=""` query parameter or change it with another solution
- [ ] Review security and `binaryMediaTypes` from API Gateway to disallow certain file types to be uploaded/served
- [ ] Test uploading other files besides images, restrict or let pass other MIME Types with a flag on Serverless
- [ ] Solve bugs within the image processing, such as the size being larger than the original with `q=70` or higher
- [ ] Test and ensure CloudFront Cache's working properly to avoid Lambda throttling
- [ ] Establish an efficient CLI Rollback of CloudFormation Stack from Serverless, it breaks because buckets related are not empty before removed
- [ ] Introduce Unit Tests back

## Consuming The Service Client-Side

On the client-side, the App needs to communicate with the service through any library that can send HTTP requests, while most endpoints are pretty straight forward there is one, in particular, that needs more work to make it work properly, the **Upload Image POST**
As described [above](#post---upload-images) needs to receive a POST request with a `binary multipart/form-data` body. Every framework/library has different ways to pack such an object, I'll show how I do it using **React/Next.js** and the `fetch` library.

```
import { useRef } from "react"

const App = () => {
  const form = useRef(null);

  const postImage = async (e) => {
    e.preventDefault();
    const data = new FormData(form.current);
    const options = {
      method: "POST",
      body: data,
    };
    const res = await fetch("https://domain.com/random/path", options);
    const loaded = await res.json();
    console.log(loaded);
  };

  return(
    <div>
      <form
        ref={form}
        encType="multipart/form-data"
        onSubmit={postImage}
      >
        <input
          multiple
          type="file"
          placeholder="Upload"
          name="data"
          onChange={changeHandler}
        />
        <input
          type="submit"
          value="Post"
        />
      </form>
    </div>
  )
}
```
The `FormData` is the interface you should be targetting when packing an object that contains the images you want to send over to be uploaded.

Most of the time you won't need to include any `Content-Type` header into the request, libraries know how to attach it automatically because the full header for such a request in its full form would look something like this `multipart/form-data; boundary=---------------------------157259096020916242283640002646`. That `boundary` is the separator between each object in the request, each image in our case. It generates when a `FormData` is created and the service is parsing this once the request gets to `Lambda`, and since you don't have to worry about it before sending the request, that's a win from both sides!

## Limits

Many limits are still unknown due to the early life of the project, this thing was just born 😅
- There is a limit of 10Mb max for payloads on the `POST` route, meaning you can't upload 50 images at once unless they're thumbnails
- I'm still breaking things, will update as soon as something happens...

## How to Contribute
If you want to contribute to the project just clone it, move to a branch with a simple naming convention `with-this-format` and push your branch, then open me a PR with some information about your changes and I'll take a look.