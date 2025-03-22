from flask import Flask, request, jsonify
import opentracing
openai.api_key = 