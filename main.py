import flask
import flask_cors
from flask import render_template, request
from controller import Controller
import json

app = flask.Flask(__name__)
flask_cors.CORS(app)


# if no input paramaters are given, the default values are used from config.json
def parse_args():
    import argparse

    cfg = json.load(open('config/config.json', 'r'))

    parser = argparse.ArgumentParser(description='Process some integers.')
    parser.add_argument('--port', type=int, default=3333, help='port to run the server on')
    parser.add_argument('--input_directory', type=str, default=cfg['json_path'],
                        help='directory to load json files from')
    parser.add_argument('--output_directory', type=str, default=cfg['json_output_path'],
                        help='directory to save json files to')
    args = parser.parse_args()

    cfg['json_path'] = args.input_directory
    cfg['json_output_path'] = args.output_directory
    cfg['port'] = args.port
    return cfg


# this will process our input json files and download and process the videos
controller = Controller(parse_args())
controller.process_videos()


@app.route('/extract_status', methods=['GET'])
def extract_status():
    global controller
    return flask.jsonify(controller.get_status())


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/current')
def current_frame():
    global controller
    controller.current_frame()

    return flask.jsonify({'image_data': controller.current_image.decode('utf-8'),
                          'object_data': controller.current_object_data})

@app.route('/update_frame', methods=['POST'])
def update_frame():
    frame_number = int(request.form['frame_number'])
    # Process the frame number and generate the new frame URL
    controller.update_frame(frame_number)

    print(frame_number)

    return flask.jsonify({'image_data': controller.current_image.decode('utf-8'),
                          'object_data': controller.current_object_data})


@app.route('/save', methods=['POST'])
def save():
    """ update the current object data and save it to the json file """
    global controller
    data = request.get_json()
    return flask.jsonify(controller.update_current_object_data(data['new_value'], data['old_value'], data['selected_object'], data['frame_data']))


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=3333)
