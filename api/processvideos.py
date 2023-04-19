import json
import requests
import os
from queue import Queue
from threading import Thread
import cv2
from typing import Union

"""

 "annotations": [
        {
            "frameNumber": 0,
            "classifications": [],
            "objects": [
                {
                    "featureId": "claqfe2df15i0070b6ahbdgjf",
                    "schemaId": "claixzmjc0dah0706ba3t101h",
                    "title": "Person",
                    "value": "person",
                    "color": "#1CE6FF",
                    "keyframe": true,
                    "bbox": {
                        "top": 617,
                        "left": 646,
                        "height": 126,
                        "width": 51
                    },
                    "classifications": []
                },
                {
                    "featureId": "claqfe2dj15ke070bcny6e4oe",
                    "schemaId": "claixzmjc0dah0706ba3t101h",
                    "title": "Person",
                    "value": "person",
                    "color": "#1CE6FF",
                    "keyframe": true,
                    "bbox": {
                        "top": 579,
                        "left": 674,
                        "height": 91,
                        "width": 33
                    },
                    "classifications": []
                }
            ],
            "relationships": []
        },
        """


def extract_frames(data: dict,
                   video_path: str,
                   output_path: str,
                   status_queue: Union[None, Queue]):
    # use opencv to load a video and extract all frames to output_path
    # use the status_queue to update the status of the download
    cap = cv2.VideoCapture(video_path)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # map all frames that have annotations to a dict
    annot_frames = {}
    for a in data['annotations']:
        annot_frames[a['frameNumber']] = a

    current_frame = 0
    while True:
        ret, frame = cap.read()
        if ret:
            filename = os.path.join(output_path, f'{current_frame:06d}.jpg').replace('\\', '/')

            cv2.imwrite(filename, frame)
            if status_queue is not None:
                status_queue.put({'status': 'downloading', 'progress': (current_frame + 1) / frame_count})
        else:
            break
        current_frame += 1
        
    cap.release()

    if status_queue is not None:
        status_queue.put({'status': 'done', 'progress': 1.0})


# download videos from the url in the json file using requests
def download_videos(videos: list, status_queue: Queue):
    # loop through json files
    for idx, video in enumerate(videos):

        url = video['video_url']
        r = requests.get(url)
        with open(video['video_filename'], 'wb') as fp:
            fp.write(r.content)

        # get filename base name
        extract_frames(data=video,
                       video_path=video['video_filename'],
                       output_path=video['frame_path'],
                       status_queue=None)


        if status_queue is not None:
            status_queue.put({'status': 'processing frames', 'progress': (idx + 1) / len(videos)})

    if status_queue is not None:
        status_queue.put({'status': 'done', 'progress': 1.0})


def process_videos(videos: list, status_queue: Queue):
    # create a thread calling download_videos, pass in the json_files and output_path, and status_queue
    t = Thread(target=download_videos, args=(videos, status_queue))
    t.daemon = True
    t.start()


