import { MessageOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import React, { createRef } from 'react';
import { Subscription } from 'rxjs';
import { LM } from 'src/translations/language-manager';
import { FixCommMsg, IntraTabCommunicator } from '../IntraTabCommunicator';
import { MessageView } from '../MessageView/MessageView';
import './SessionMessageView.scss';
import html2canvas from 'html2canvas';
import { CameraOutlined, CameraFilled } from '@ant-design/icons';


const getIntlMessage = (msg: string, options?: any) => {
  return LM.getMessage(`session_message_view.${msg}`, options);
}

interface SessionMessageViewProps {
  communicator: IntraTabCommunicator;
}

interface SessionMessageViewState {
  selectedMsg?: FixCommMsg;
}
export class SessionMessageView extends React.Component<SessionMessageViewProps, SessionMessageViewState> {
  private msgSelectSubscription?: Subscription;

  constructor(props: any) {
    super(props);
    this.state = {}
  }
  componentDidMount() {
    this.msgSelectSubscription = this.props.communicator.getMessageSelectObservable().subscribe(selectedMsg => {
      this.setState({ selectedMsg })
    })
  }

  componentWillUnmount() {
    this.msgSelectSubscription?.unsubscribe();
  }

  handleScreenshot = (elem: HTMLDivElement) => {
    html2canvas(elem, { scale: 2, backgroundColor: "#1e1e1e"
    }).then(canvas => {
      const message: FixCommMsg | undefined = this.state.selectedMsg;
      if (!message) return;
      
      const dataURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');

      link.download = `${Date.now()}_${message?.def.name}.png`;
      link.href = dataURL;
      link.click();
    });
  }

  render() {
    const { selectedMsg } = this.state;
    const ref = createRef<HTMLDivElement>()

    return <div className="session-message-view-wrapper ">
      <div className="header">
        <div className="title"><MessageOutlined />{getIntlMessage("title")}</div>
      <Button style={{
        backgroundColor: "inherit"
      }}
      icon={<CameraOutlined disabled={(this.state.selectedMsg == undefined)} />} disabled={(this.state.selectedMsg == undefined)}  onClick={e => {
        if (ref.current) this.handleScreenshot(ref.current);
      }} title={"Take Screenshot"}></Button>
      </div>
      <div className="body">
        <div className="container" ref={ref} style={{
          height: "fit-content"
        }}>
          <MessageView selectedMsg={selectedMsg}/>
        </div>
      </div>
    </div>
  }
}

