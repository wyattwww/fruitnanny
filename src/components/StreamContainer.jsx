import React, { Component } from "react";
// import PropTypes from 'prop-types'
import Janus from "../lib/janus";
import VideoPlayer from "./VideoPlayer";

export default class StreamContainer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isStreaming: false,
      stream: null
    };

    this.janus = {
      session: null,
      streamHandle: null
    };
  }

  componentDidMount() {
    Janus.init({
      debug: true,
      callback: this.createSession.bind(this)
    });
  }

  createSession() {
    if (!Janus.isWebrtcSupported()) {
      window.alert("Browser does not support WebRTC stream");
    } else {
      this.janus.session = new Janus({
        server: "/janus",
        success: this.onSessionSuccess.bind(this),
        error: error => {
          // TODO: stop spinner in video player by passing an active session prop
          // if (spinner !== null && spinner !== undefined)
          //   spinner.stop();
          Janus.error(error);
          window.alert(error);
        },
        destroyed: () => {
          // if (spinner !== null && spinner !== undefined)
          //   spinner.stop();
        }
      });
    }
  }

  onSessionSuccess() {
    this.janus.session.attach({
      plugin: "janus.plugin.streaming",
      success: this.handleAttachSuccess.bind(this),
      onmessage: this.onMessage.bind(this),
      onremotestream: this.handleRemoteStream.bind(this),
      error: error => {
        // TODO
        // if (spinner !== null && spinner !== undefined)
        //   spinner.stop();
        Janus.error("  -- Error attaching plugin... ", error);
        window.alert(`Error attaching plugin... ${error}`);
      },
      oncleanup: () => {
        Janus.log(" ::: Got a cleanup notification :::");
      }
    });
  }

  handleAttachSuccess(pluginHandle) {
    this.janus.streamHandle = pluginHandle;
    Janus.log(
      `Plugin attached! (${this.janus.streamHandle.getPlugin()}, id=${this.janus.streamHandle.getId()})`
    );

    // Load stream
    Janus.debug('Sending message ({ request: "list" })');
    this.janus.streamHandle.send({
      message: { request: "list" },
      success: this.handleStreamList.bind(this)
    });
  }

  handleStreamList(result) {
    if (result === null || result === undefined) {
      window.alert("Got no response to our query for available streams");
      return;
    }

    let selectedStream;
    if (result.list) {
      const { list } = result;
      Janus.log("Got a list of available streams");
      Janus.debug(list);
      selectedStream = list[0].id;
    }

    // Request specific stream
    Janus.log(`Selected video id #${selectedStream}`);
    if (selectedStream === undefined || selectedStream === null) {
      window.alert("Select a stream from the list");
      return;
    }

    this.janus.streamHandle.send({
      message: {
        request: "watch",
        id: parseInt(selectedStream, 10)
      }
    });
  }

  onMessage(msg, jsep) {
    Janus.debug(" ::: Got a message :::");
    Janus.debug(JSON.stringify(msg));
    const { result } = msg;
    if (result && result.status) {
      const { status } = result;

      // TODO: where are these els?
      if (status === "starting") {
        // $('#status').removeClass('hide').text("Starting, please wait...").show();
      } else if (status === "started") {
        // $('#status').removeClass('hide').text("Started").show();
      } else if (status === "stopped") {
        // FIXME: no definition??
        // stopStream();
      }
    } else if (msg.error) {
      window.alert(msg.error);
      // stopStream();
      return;
    }

    if (jsep) {
      Janus.debug("Handling SDP as well...");
      Janus.debug(jsep);
      // Answer
      this.janus.streamHandle.createAnswer({
        jsep,
        media: {
          // We want recvonly audio/video
          audioSend: false,
          videoSend: false
        },
        success: () => {
          Janus.debug("Got SDP!");
          Janus.debug(jsep);
          this.janus.streamHandle.send({
            jsep,
            message: { request: "start" }
          });
        },
        error: error => {
          // if (spinner !== null && spinner !== undefined)
          //   spinner.stop();
          Janus.error("WebRTC error:", error);
          window.alert(`WebRTC error... ${JSON.stringify(error)}`);
        }
      });
    }
  }

  handleRemoteStream(stream) {
    Janus.debug(" ::: Got a remote stream :::");
    Janus.debug(JSON.stringify(stream));

    this.setState({ stream, isStreaming: true });
    // TODO: set state and update VideoPlayer
    // $("#video").bind("playing", function () {
    //   if (spinner !== null && spinner !== undefined)
    //     spinner.stop();
    //   spinner = null;
    // });

    // TODO: all this does is set element src. Let react handle it
    // Janus.attachMediaStream($('#video').get(0), stream);

    // TODO: pass as props to spectrum
    // streamContext.init(stream);
    // audioSpectrumWidget.enable();
  }

  render() {
    return (
      <VideoPlayer
        stream={this.state.stream}
        isStreaming={this.state.isStreaming}
      />
    );
  }
}