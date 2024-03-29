from queue import Queue
from natsort import natsorted
from glob import glob
from processvideos import process_videos
import json
import os
import cv2
from uuid import uuid4
import base64


def draw_text(img, text,
              font=cv2.FONT_HERSHEY_SIMPLEX,
              pos=(0, 0),
              font_scale=3,
              font_thickness=2,
              text_color=(0, 255, 0),
              text_color_bg=(0, 0, 0)
              ):
    x, y = pos
    text_size, _ = cv2.getTextSize(text, font, font_scale, font_thickness)
    text_w, text_h = text_size
    cv2.rectangle(img, pos, (x + text_w, y + text_h), text_color_bg, -1)
    cv2.putText(img, text, (x, y + text_h + font_scale - 1), font, font_scale, text_color, font_thickness)

    return text_size


class Controller:

    def __init__(self, cfg: dict):
        self.cfg = cfg
        # the current object data
        self.current_object_data = None
        # the annotation data
        self.data = []
        # the current index in our frame map
        self.current_index = 0
        # process all json files
        self.json_files = natsorted(list(glob(cfg['json_path'] + '/*.json')))

        self.status_queue = Queue()

        # flags download of videos is finished
        self.download_finished = False

        # a list of all consecutive frames regardless of video file
        self.frame_map = []

        self.current_image = None

        self.process_json_files()

        print(self.json_files)
        print(self.frame_map)

    def next_frame(self):
        self._set_frame(nextframe=True)

    def prev_frame(self):
        self._set_frame(nextframe=False)

    def _set_frame(self, nextframe=True):
        """
        This function will set the current frame and object data
        :param nextframe:
        :return:
        """
        if nextframe:
            self.current_index += 1
        else:
            self.current_index -= 1

        if self.current_index < 0:
            self.current_index = len(self.frame_map) - 1
        elif self.current_index >= len(self.frame_map):
            self.current_index = 0

        self.current_object_data = self.frame_map[self.current_index]

        self.markup_frame(self.current_object_data)

    def current_frame(self):
        if self.current_index < 0:
            return None

        self.current_object_data = self.frame_map[self.current_index]

        self.markup_frame(self.current_object_data)

    def markup_frame(self, current_object_data):
        """
         This function will markup a frame with the given object data
         :param object_data:
         :return:
         """
        # get frame
        if current_object_data is None:
            raise Exception('No object data found')

        frame_no = current_object_data['frame']

        img = cv2.imread(os.path.join(current_object_data['frame_path'], f'{frame_no:06d}.jpg'))

        for obj in self.current_object_data['objects']:
            x, y, w, h = obj['bbox']['left'], obj['bbox']['top'], obj['bbox']['width'], obj['bbox']['height']
            cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)

        # draw labels on top
        for obj in self.current_object_data['objects']:
            x, y, w, h = obj['bbox']['left'], obj['bbox']['top'], obj['bbox']['width'], obj['bbox']['height']
            draw_text(img=img,
                      text=obj['classifications'][0]['answer']['value'],
                      pos=(x, y - 20),
                      font_scale=1,
                      font_thickness=2,
                      text_color=(0, 0, 255),
                      text_color_bg=(0, 0, 0))

        # cv2.putText(img, obj['classifications'][0]['answer']['value'], (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 200), 2)

        # encode image usine imencode then conver it to a base64 buffer
        try:
            retval, buffer_img = cv2.imencode('.jpg', img)
        except Exception as e:
            print(e)
            return

        self.current_image = base64.b64encode(buffer_img)

        return self.current_image

    def get_status(self):
        # get from queue with a timeout of 1 second, check exception
        try:
            status = self.status_queue.get(timeout=1)
        except:
            if self.download_finished:
                status = {'status': 'done', 'progress': 1.0}
            else:
                status = {'status': 'waiting'}

        if status['status'] == 'done':
            if not self.download_finished:
                self.current_object_data = self.frame_map[0]
                self.markup_frame(self.current_object_data)
            self.download_finished = True

        return status

    def process_videos(self):
        """
        This function will process all videos and extract all frames
        :return:
        """
        process_videos(self.data, self.status_queue)

    def process_json_files(self):
        """
        This function will create our datasource for all of our input json files
        :return:
        """

        # create all directories
        os.makedirs(self.cfg['video_path'], exist_ok=True)
        os.makedirs(os.path.join(self.cfg['video_path'], 'frames'), exist_ok=True)
        os.makedirs(self.cfg['json_output_path'], exist_ok=True)

        videos = []
        for idx, json_file in enumerate(self.json_files):
            with open(json_file, 'r') as fp:
                data = json.load(fp)

            # get download url and local output path for our videos
            download_url = data['video_url']
            video_filename = download_url.split('/')[-1]
            base_video_filename = video_filename.split('.')[0]
            video_filename = os.path.join(self.cfg['video_path'], video_filename)

            # get output path for individual frames, and make it if it does not exist
            frame_path = os.path.join(self.cfg['video_path'], 'frames', base_video_filename)
            os.makedirs(frame_path, exist_ok=True)

            # for this video file iterate over it and collect all frames which have objects
            # ignore those that do not
            annotations = []
            first_frame = 99999
            last_frame = -9999
            for annot in data['annotations']:

                # check if there are any objects for this frame
                if 'objects' not in annot or len(annot['objects']) == 0:
                    continue

                # check each object for classifications
                objects = []
                for obj in annot['objects']:
                    if 'classifications' not in obj or len(obj['classifications']) == 0:
                        continue
                    else:
                        objects.append(obj)

                if objects:
                    first_frame = annot['frameNumber'] if annot['frameNumber'] < first_frame else first_frame
                    last_frame = annot['frameNumber'] if annot['frameNumber'] > last_frame else last_frame

                    annot['objects'] = objects
                    annotations.append(annot)

            if annotations:
                data['annotations'] = annotations
                data['video_filename'] = video_filename
                data['video_basename'] = base_video_filename
                data['frame_path'] = frame_path
                data['first_frame'] = first_frame
                data['last_frame'] = last_frame
                data['json_file'] = json_file
                videos.append(data)

        self.data = videos

        frame_map = []
        for video in videos:
            for annot in video['annotations']:
                frame_map.append({
                    'json_file': video['json_file'],
                    'video': video['video_basename'],
                    'frame_path': video['frame_path'],
                    'objects': annot['objects'],
                    'frame': annot['frameNumber']
                })

        self.frame_map = frame_map

    def _update_answers(self, data: dict, old_value: str, new_value: str):
        """ iterates over each classification and answer value to update the answer value with the new answer value
         :param data: the data to update
         :param old_value: the old value to replace
         :param new_value: the new value to replace with
         :return: the updated data
         """
        for annot in data['annotations']:
            for obj in annot['objects']:
                for classification in obj['classifications']:
                    if classification['answer']['value'] == old_value:
                        classification['answer']['value'] = new_value
        return data

    def update_current_object_data(self, new_value: str, old_value: str):
        """
        This function will update the current object data
        :param old_value:
        :param new_value:
        :param object_data:
        :return:
        """
        # find the json corresponding to this updated data
        json_file = self.current_object_data['json_file']
        with open(json_file, 'r') as fp:
            data = json.load(fp)

        data = self._update_answers(data, old_value, new_value)

        try:
            with open(os.path.join(self.cfg['json_output_path'], os.path.basename(json_file)), 'w') as fp:
                json.dump(data, fp, indent=4)
        except Exception as e:
            print(e)
            return {'error': 'Could not write updated json file'}

        # update local data
        selected_video = None
        for video in self.data:
            if video['video_basename'] == self.current_object_data['video']:
                selected_video = video
                self._update_answers(video, old_value, new_value)

        assert selected_video is not None

        # rebuild frame map
        self.frame_map = []
        for video in self.data:
            for annot in video['annotations']:
                self.frame_map.append({
                    'json_file': video['json_file'],
                    'video': video['video_basename'],
                    'frame_path': video['frame_path'],
                    'objects': annot['objects'],
                    'frame': annot['frameNumber']
                })

        self.current_object_data = self.frame_map[self.current_index]
        self.markup_frame(self.current_object_data)

        return {'image_data': self.current_image.decode('utf-8'),
                'object_data': self.current_object_data}


if __name__ == '__main__':

    with open('config/config.json', 'r') as fp:
        cfg = json.load(fp)

    controller = Controller(cfg)
    controller.process_videos()

    while True:
        item = controller.status_queue.get()

        if item['status'] == 'done':
            break

    print('Finished')
