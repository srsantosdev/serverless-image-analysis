'use strict';

const axios = require('axios')
const aws = require('aws-sdk')

const reko = new aws.Rekognition()
const translator = new aws.Translate()

class Handler {
  constructor ({ rekoSvc, translatorSvc }) {
    this.rekoSvc = rekoSvc
    this.translatorSvc = translatorSvc
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer,
      }
    }).promise()

    const workingItems = result.Labels
      .filter(({ Confidence }) => Confidence > 80)

    const names = workingItems
      .map(({ Name }) => Name)
      .join(' and ')

    return { names, workingItems }
  }

  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text,
    }

    const { TranslatedText } = await this.translatorSvc.translateText(params).promise()

    return TranslatedText.split(' e ')
  }

  formatJSONResults(texts, workingItems) {
    const finalResult = []

    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workingItems[indexText].Confidence

      finalResult.push({
        name: nameInPortuguese,
        confidence: confidence.toFixed(2)
      })
    }

    return finalResult;
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.default.get(imageUrl, {
      responseType: 'arraybuffer'
    })

    const buffer = Buffer.from(response.data, 'base64')

    return buffer
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters

      const buffer = await this.getImageBuffer(imageUrl)

      const { names, workingItems } = await this.detectImageLabels(buffer)

      const texts = await this.translateText(names)

      const finalResult = this.formatJSONResults(texts, workingItems)

      return {
        statusCode: 200,
        body: finalResult
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: error
      }
    }
  }
}

const handler = new Handler({
  rekoSvc: reko,
  translatorSvc: translator,
})

module.exports.main = handler.main.bind(handler)
